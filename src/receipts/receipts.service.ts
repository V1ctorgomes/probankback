import { Injectable } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InterestService } from '../loans/interest.service';
import {
  endOfMonth,
  dueDateForReference,
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

    const activeLoans = await this.prisma.loan.findMany({
      where: {
        status: LoanStatus.ATIVO,
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: { select: { id: true, nome: true, cpf: true } },
        interestCycles: { where: { referencia: reference } },
      },
    });

    const pending: Array<{
      cycleId: string;
      loanId: string;
      referencia: string;
      jurosPendente: number;
      principalAtual: number;
      customer: { id: string; nome: string; cpf: string };
      overdue: boolean;
    }> = [];

    for (const loan of activeLoans) {
      await this.interestService.ensureCycles(loan.id);
      const cycle = await this.prisma.interestCycle.findUnique({
        where: {
          loanId_referencia: { loanId: loan.id, referencia: reference },
        },
      });

      if (!cycle) continue;

      const jurosPendente = roundMoney(
        toNumber(cycle.jurosGerado) - toNumber(cycle.jurosPago),
      );
      if (jurosPendente <= 0) continue;

      const cycleDueDate = dueDateForReference(reference, loan.diaPagamento);

      pending.push({
        cycleId: cycle.id,
        loanId: loan.id,
        referencia: reference,
        jurosPendente,
        principalAtual: toNumber(loan.principalAtual),
        customer: loan.customer,
        overdue: cycleDueDate < new Date(),
      });
    }

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

    const pendingTotal = roundMoney(
      pending.reduce((sum, item) => sum + item.jurosPendente, 0),
    );
    const receivedTotal = roundMoney(
      received.reduce((sum, item) => sum + item.valor, 0),
    );

    return {
      month: reference,
      pending,
      pendingTotal,
      received,
      receivedTotal,
    };
  }
}
