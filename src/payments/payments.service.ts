import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoanStatus, TransactionOrigin, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InterestService } from '../loans/interest.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { roundMoney, toNumber } from '../common/utils/money.util';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private interestService: InterestService,
  ) {}

  async create(dto: CreatePaymentDto, userId: string, ip?: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id: dto.loanId } });
    if (!loan) {
      throw new NotFoundException('Empréstimo não encontrado');
    }
    if (loan.status !== LoanStatus.ATIVO) {
      throw new BadRequestException('Contrato não está ativo');
    }

    await this.interestService.ensureCycles(loan.id);
    const pendingInterest = await this.interestService.getPendingInterest(
      loan.id,
    );

    const jurosAbatido = roundMoney(Math.min(dto.valor, pendingInterest));
    const principalAbatido = roundMoney(dto.valor - jurosAbatido);
    const principalAtual = toNumber(loan.principalAtual);

    if (principalAbatido > principalAtual + 0.01) {
      throw new BadRequestException(
        'Valor excede saldo de juros e principal em aberto',
      );
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const appliedInterest = await this.interestService.applyInterestPayment(
        loan.id,
        jurosAbatido,
        tx,
      );

      const appliedPrincipal = roundMoney(
        Math.min(principalAbatido, principalAtual),
      );
      const newPrincipal = roundMoney(principalAtual - appliedPrincipal);

      const remainingInterest = roundMoney(pendingInterest - appliedInterest);
      const newStatus =
        newPrincipal <= 0 && remainingInterest <= 0
          ? LoanStatus.QUITADO
          : LoanStatus.ATIVO;

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          principalAtual: newPrincipal,
          status: newStatus,
        },
      });

      const createdPayment = await tx.payment.create({
        data: {
          loanId: loan.id,
          valor: dto.valor,
          jurosAbatido: appliedInterest,
          principalAbatido: appliedPrincipal,
          userId,
        },
        include: {
          user: { select: { id: true, nome: true } },
          loan: {
            select: {
              id: true,
              principalAtual: true,
              status: true,
              customer: { select: { nome: true } },
            },
          },
        },
      });

      const category = await tx.category.findFirst({
        where: { id: 'cat-income-loan' },
      });

      await tx.transaction.create({
        data: {
          tipo: TransactionType.INCOME,
          origem: TransactionOrigin.LOAN_PAYMENT,
          descricao: `Recebimento - ${createdPayment.loan.customer.nome}`,
          categoryId: category?.id,
          valor: dto.valor,
          data: new Date(),
          paymentId: createdPayment.id,
          userId,
        },
      });

      return createdPayment;
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'Payment',
      entityId: payment.id,
      ip,
    });

    return {
      ...payment,
      valor: toNumber(payment.valor),
      jurosAbatido: toNumber(payment.jurosAbatido),
      principalAbatido: toNumber(payment.principalAbatido),
      loan: {
        ...payment.loan,
        principalAtual: toNumber(payment.loan.principalAtual),
      },
    };
  }

  async findByLoan(loanId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { loanId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, nome: true } } },
    });

    return payments.map((payment) => ({
      ...payment,
      valor: toNumber(payment.valor),
      jurosAbatido: toNumber(payment.jurosAbatido),
      principalAbatido: toNumber(payment.principalAbatido),
    }));
  }
}
