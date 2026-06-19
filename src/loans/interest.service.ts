import { Injectable } from '@nestjs/common';
import { Loan, LoanStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addMonths,
  formatMonthReference,
  monthStart,
  roundMoney,
  toNumber,
} from '../common/utils/money.util';

@Injectable()
export class InterestService {
  constructor(private prisma: PrismaService) {}

  async ensureCycles(loanId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const loan = await db.loan.findUnique({
      where: { id: loanId },
      include: { interestCycles: { orderBy: { referencia: 'asc' } } },
    });

    if (!loan || loan.status !== LoanStatus.ATIVO) {
      return loan;
    }

    const start = monthStart(loan.dataInicio);
    const current = monthStart(new Date());
    let cursor = start;
    let principalSnapshot = toNumber(loan.principalOriginal);

    const payments = await db.payment.findMany({
      where: { loanId },
      orderBy: { createdAt: 'asc' },
    });

    while (cursor <= current) {
      const reference = formatMonthReference(cursor);
      const existing = loan.interestCycles.find((c) => c.referencia === reference);

      principalSnapshot = this.principalAtMonthStart(
        loan,
        payments,
        cursor,
        principalSnapshot,
      );

      if (!existing) {
        const jurosGerado = roundMoney(
          principalSnapshot * toNumber(loan.taxaJurosMensal),
        );

        await db.interestCycle.create({
          data: {
            loanId,
            referencia: reference,
            principalBase: principalSnapshot,
            jurosGerado,
          },
        });
      }

      cursor = addMonths(cursor, 1);
    }

    return db.loan.findUnique({
      where: { id: loanId },
      include: { interestCycles: { orderBy: { referencia: 'asc' } } },
    });
  }

  private principalAtMonthStart(
    loan: Loan,
    payments: Array<{ createdAt: Date; principalAbatido: Prisma.Decimal }>,
    month: Date,
    fallback: number,
  ): number {
    const monthEnd = addMonths(month, 1);
    let principal = toNumber(loan.principalOriginal);

    for (const payment of payments) {
      if (payment.createdAt < monthEnd) {
        principal -= toNumber(payment.principalAbatido);
      }
    }

    return roundMoney(Math.max(principal, 0)) || fallback;
  }

  async getPendingInterest(loanId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    await this.ensureCycles(loanId, db);

    const cycles = await db.interestCycle.findMany({
      where: { loanId },
      orderBy: { referencia: 'asc' },
    });

    return cycles.reduce(
      (total, cycle) =>
        total + roundMoney(toNumber(cycle.jurosGerado) - toNumber(cycle.jurosPago)),
      0,
    );
  }

  async applyInterestPayment(
    loanId: string,
    amount: number,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const cycles = await tx.interestCycle.findMany({
      where: { loanId },
      orderBy: { referencia: 'asc' },
    });

    let remaining = amount;
    let applied = 0;

    for (const cycle of cycles) {
      const pending = roundMoney(
        toNumber(cycle.jurosGerado) - toNumber(cycle.jurosPago),
      );
      if (pending <= 0 || remaining <= 0) {
        continue;
      }

      const pay = Math.min(pending, remaining);
      await tx.interestCycle.update({
        where: { id: cycle.id },
        data: { jurosPago: toNumber(cycle.jurosPago) + pay },
      });
      remaining = roundMoney(remaining - pay);
      applied = roundMoney(applied + pay);
    }

    return applied;
  }
}
