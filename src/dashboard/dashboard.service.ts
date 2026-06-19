import { Injectable } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InterestService } from '../loans/interest.service';
import {
  endOfDay,
  endOfMonth,
  roundMoney,
  startOfDay,
  startOfMonth,
  toNumber,
} from '../common/utils/money.util';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private interestService: InterestService,
  ) {}

  async getStats() {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStartDate = startOfMonth(now);
    const monthEndDate = endOfMonth(now);

    const [loans, paymentsToday, paymentsMonth] = await Promise.all([
      this.prisma.loan.findMany({
        include: { interestCycles: true },
      }),
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { valor: true },
      }),
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: monthStartDate, lte: monthEndDate } },
        _sum: { valor: true },
      }),
    ]);

    let principalEmAberto = 0;
    let jurosPendentes = 0;
    let totalEmprestado = 0;
    let contratosAtivos = 0;
    let contratosQuitados = 0;
    let contratosEmAtraso = 0;

    for (const loan of loans) {
      totalEmprestado += toNumber(loan.principalOriginal);

      if (loan.status === LoanStatus.ATIVO) {
        contratosAtivos += 1;
        principalEmAberto += toNumber(loan.principalAtual);
        const pending = await this.interestService.getPendingInterest(loan.id);
        jurosPendentes += pending;

        const hasOverdue = loan.interestCycles.some((cycle) => {
          const pendingCycle =
            toNumber(cycle.jurosGerado) - toNumber(cycle.jurosPago);
          const [year, month] = cycle.referencia.split('-').map(Number);
          const cycleEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
          return pendingCycle > 0 && cycleEnd < now;
        });

        if (hasOverdue) {
          contratosEmAtraso += 1;
        }
      }

      if (loan.status === LoanStatus.QUITADO) {
        contratosQuitados += 1;
      }
    }

    return {
      totalEmprestado: roundMoney(totalEmprestado),
      principalEmAberto: roundMoney(principalEmAberto),
      jurosPendentes: roundMoney(jurosPendentes),
      recebidoHoje: roundMoney(toNumber(paymentsToday._sum.valor ?? 0)),
      recebidoMes: roundMoney(toNumber(paymentsMonth._sum.valor ?? 0)),
      contratosAtivos,
      contratosEmAtraso,
      contratosQuitados,
    };
  }
}
