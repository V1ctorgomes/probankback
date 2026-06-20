import { Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InterestService } from '../loans/interest.service';
import { normalizeCpf, validateCpf } from '../common/utils/cpf.util';
import { roundMoney, toNumber } from '../common/utils/money.util';
import { serializeInterestCycle } from '../common/utils/interest-cycle.util';

@Injectable()
export class PortalService {
  constructor(
    private prisma: PrismaService,
    private interestService: InterestService,
  ) {}

  async lookupByCpf(cpf: string) {
    const digits = normalizeCpf(cpf);

    if (digits.length !== 11) {
      return { ok: false as const, error: 'Informe um CPF com 11 dígitos.' };
    }

    if (!validateCpf(digits)) {
      return { ok: false as const, error: 'CPF inválido. Verifique os números digitados.' };
    }

    const customer = await this.prisma.customer.findFirst({
      where: { cpf: digits, ativo: true },
      include: {
        loans: {
          where: { status: { in: [LoanStatus.ATIVO, LoanStatus.QUITADO] } },
          orderBy: { createdAt: 'desc' },
          include: { interestCycles: { orderBy: { referencia: 'asc' } } },
        },
      },
    });

    if (!customer) {
      return { ok: false as const, error: 'CPF não encontrado em nossa base.' };
    }

    let totalDebt = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    const contracts: Array<{
      dataInicio: string;
      diaPagamento: number;
      status: string;
      principalAtual: number;
      jurosPendentes: number;
      ciclos: Array<{
        referencia: string;
        jurosGerado: number;
        jurosPago: number;
        jurosPendente: number;
        vencimento: string;
        status: 'PAGO' | 'PENDENTE' | 'ATRASADO';
      }>;
    }> = [];

    for (const loan of customer.loans) {
      if (loan.status === LoanStatus.ATIVO) {
        await this.interestService.ensureCycles(loan.id);
        const jurosPendentes = await this.interestService.getPendingInterest(
          loan.id,
        );
        totalDebt += toNumber(loan.principalAtual) + jurosPendentes;

        const cycles = await this.prisma.interestCycle.findMany({
          where: { loanId: loan.id },
          orderBy: { referencia: 'asc' },
        });

        const now = new Date();
        const cycleItems = cycles
          .map((cycle) => {
            const serialized = serializeInterestCycle(
              cycle,
              loan.diaPagamento,
              now,
            );
            if (serialized.status === 'ATRASADO') {
              overdueCount += 1;
            }
            return {
              referencia: serialized.referencia,
              jurosGerado: serialized.jurosGerado,
              jurosPago: serialized.jurosPago,
              jurosPendente: serialized.jurosPendente,
              vencimento: serialized.vencimento,
              status: serialized.status,
            };
          })
          .sort((left, right) => left.referencia.localeCompare(right.referencia));

        contracts.push({
          dataInicio: loan.dataInicio.toISOString(),
          diaPagamento: loan.diaPagamento,
          status:
            loan.status === LoanStatus.ATIVO
              ? 'Ativo'
              : loan.status === LoanStatus.QUITADO
                ? 'Quitado'
                : 'Encerrado',
          principalAtual: toNumber(loan.principalAtual),
          jurosPendentes,
          ciclos: cycleItems,
        });
      }

      if (loan.status === LoanStatus.QUITADO) {
        totalPaid += toNumber(loan.principalOriginal);
      }
    }

    const payments = await this.prisma.payment.findMany({
      where: { loan: { customerId: customer.id } },
    });
    totalPaid = roundMoney(
      payments.reduce((sum, payment) => sum + toNumber(payment.valor), 0),
    );

    return {
      ok: true as const,
      data: {
        clientName: customer.nome,
        totalDebt: roundMoney(totalDebt),
        totalPaid,
        overdueCount,
        contracts,
      },
    };
  }
}
