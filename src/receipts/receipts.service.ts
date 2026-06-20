import { Injectable } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InterestService } from '../loans/interest.service';
import {
  INTEREST_CYCLE_STATUS_ORDER,
  InterestCycleStatus,
  serializeInterestCycle,
} from '../common/utils/interest-cycle.util';
import {
  endOfMonth,
  roundMoney,
  startOfMonth,
  toNumber,
} from '../common/utils/money.util';

@Injectable()
export class ReceiptsService {
  constructor(
    private prisma: PrismaService,
    private interestService: InterestService,
  ) {}

  async getByMonth(month: string, customerId?: string) {
    const [year, monthNum] = month.split('-').map(Number);
    if (!year || !monthNum) {
      month = new Date().toISOString().slice(0, 7);
    }

    const reference = month.match(/^\d{4}-\d{2}$/)
      ? month
      : new Date().toISOString().slice(0, 7);

    const [y, m] = reference.split('-').map(Number);
    const monthStart = startOfMonth(new Date(Date.UTC(y, m - 1, 1)));
    const monthEnd = endOfMonth(new Date(Date.UTC(y, m - 1, 1)));
    const now = new Date();

    const activeLoans = await this.prisma.loan.findMany({
      where: {
        status: LoanStatus.ATIVO,
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: { select: { id: true, nome: true, cpf: true } },
      },
    });

    const installments: Array<{
      cycleId: string;
      loanId: string;
      referencia: string;
      jurosGerado: number;
      jurosPago: number;
      jurosPendente: number;
      vencimento: string;
      status: InterestCycleStatus;
      principalAtual: number;
      customer: { id: string; nome: string; cpf: string };
    }> = [];

    for (const loan of activeLoans) {
      await this.interestService.ensureCycles(loan.id);
      const cycle = await this.prisma.interestCycle.findUnique({
        where: {
          loanId_referencia: { loanId: loan.id, referencia: reference },
        },
      });

      if (!cycle) continue;

      const serialized = serializeInterestCycle(cycle, loan.diaPagamento, now);

      installments.push({
        cycleId: serialized.id,
        loanId: loan.id,
        referencia: serialized.referencia,
        jurosGerado: serialized.jurosGerado,
        jurosPago: serialized.jurosPago,
        jurosPendente: serialized.jurosPendente,
        vencimento: serialized.vencimento,
        status: serialized.status,
        principalAtual: toNumber(loan.principalAtual),
        customer: loan.customer,
      });
    }

    installments.sort((left, right) => {
      const statusDiff =
        INTEREST_CYCLE_STATUS_ORDER[left.status] -
        INTEREST_CYCLE_STATUS_ORDER[right.status];
      if (statusDiff !== 0) return statusDiff;
      return left.customer.nome.localeCompare(right.customer.nome, 'pt-BR');
    });

    const summary = {
      total: installments.length,
      pagos: installments.filter((item) => item.status === 'PAGO').length,
      pendentes: installments.filter((item) => item.status === 'PENDENTE').length,
      atrasados: installments.filter((item) => item.status === 'ATRASADO').length,
      valorPago: roundMoney(
        installments
          .filter((item) => item.status === 'PAGO')
          .reduce((sum, item) => sum + item.jurosGerado, 0),
      ),
      valorPendente: roundMoney(
        installments
          .filter((item) => item.status === 'PENDENTE')
          .reduce((sum, item) => sum + item.jurosPendente, 0),
      ),
      valorAtrasado: roundMoney(
        installments
          .filter((item) => item.status === 'ATRASADO')
          .reduce((sum, item) => sum + item.jurosPendente, 0),
      ),
    };

    const pending = installments.filter((item) => item.status !== 'PAGO');
    const pendingTotal = roundMoney(
      pending.reduce((sum, item) => sum + item.jurosPendente, 0),
    );

    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: { gte: monthStart, lte: monthEnd },
        ...(customerId ? { loan: { customerId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, nome: true } },
        loan: {
          include: {
            customer: { select: { id: true, nome: true, cpf: true } },
          },
        },
      },
    });

    const received = payments.map((payment) => ({
      id: payment.id,
      valor: toNumber(payment.valor),
      jurosAbatido: toNumber(payment.jurosAbatido),
      principalAbatido: toNumber(payment.principalAbatido),
      createdAt: payment.createdAt,
      user: payment.user,
      loanId: payment.loanId,
      customer: payment.loan.customer,
    }));

    const receivedTotal = roundMoney(
      received.reduce((sum, item) => sum + item.valor, 0),
    );

    return {
      month: reference,
      installments,
      summary,
      pending,
      pendingTotal,
      received,
      receivedTotal,
    };
  }
}
