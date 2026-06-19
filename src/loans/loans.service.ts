import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoanStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InterestService } from './interest.service';
import { CreateLoanDto } from './dto/loan.dto';
import { roundMoney, toNumber } from '../common/utils/money.util';

type LoanWithRelations = Prisma.LoanGetPayload<{
  include: {
    customer: true;
    interestCycles: true;
    payments: { include: { user: { select: { id: true; nome: true } } } };
  };
}>;

type LoanListItem = Prisma.LoanGetPayload<{
  include: {
    customer: { select: { id: true; nome: true; cpf: true } };
    interestCycles: true;
  };
}>;

@Injectable()
export class LoansService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private interestService: InterestService,
  ) {}

  async create(dto: CreateLoanDto, userId: string, ip?: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer || !customer.ativo) {
      throw new NotFoundException('Cliente não encontrado ou inativo');
    }

    const loan = await this.prisma.loan.create({
      data: {
        customerId: dto.customerId,
        principalOriginal: dto.principalOriginal,
        principalAtual: dto.principalOriginal,
        taxaJurosMensal: dto.taxaJurosMensal,
        dataInicio: new Date(dto.dataInicio),
      },
      include: { customer: { select: { id: true, nome: true, cpf: true } } },
    });

    await this.interestService.ensureCycles(loan.id);
    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'Loan',
      entityId: loan.id,
      ip,
    });

    return this.serializeLoan(loan);
  }

  async findAll(status?: LoanStatus) {
    const loans = await this.prisma.loan.findMany({
      where: status ? { status } : undefined,
      include: {
        customer: { select: { id: true, nome: true, cpf: true } },
        interestCycles: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(loans.map((loan) => this.enrichLoan(loan)));
  }

  async findOne(id: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        customer: true,
        interestCycles: { orderBy: { referencia: 'asc' } },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, nome: true } } },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Empréstimo não encontrado');
    }

    return this.enrichLoan(loan);
  }

  async close(id: string, userId: string, ip?: string) {
    const loan = await this.findOne(id);
    if (loan.status !== LoanStatus.ATIVO) {
      throw new BadRequestException('Contrato já encerrado');
    }

    const updated = await this.prisma.loan.update({
      where: { id },
      data: { status: LoanStatus.ENCERRADO },
    });

    await this.auditService.log({
      userId,
      action: 'CLOSE',
      entity: 'Loan',
      entityId: id,
      ip,
    });

    return this.serializeLoan(updated);
  }

  private async enrichLoan(loan: LoanWithRelations | LoanListItem) {
    await this.interestService.ensureCycles(loan.id);
    const jurosPendentes = await this.interestService.getPendingInterest(
      loan.id,
    );

    return {
      ...this.serializeLoan(loan),
      jurosPendentes,
      interestCycles: loan.interestCycles.map((cycle) => ({
        ...cycle,
        principalBase: toNumber(cycle.principalBase),
        jurosGerado: toNumber(cycle.jurosGerado),
        jurosPago: toNumber(cycle.jurosPago),
        jurosPendente: roundMoney(
          toNumber(cycle.jurosGerado) - toNumber(cycle.jurosPago),
        ),
      })),
      payments:
        'payments' in loan
          ? loan.payments.map((payment) => ({
              ...payment,
              valor: toNumber(payment.valor),
              jurosAbatido: toNumber(payment.jurosAbatido),
              principalAbatido: toNumber(payment.principalAbatido),
            }))
          : undefined,
    };
  }

  private serializeLoan(loan: {
    id: string;
    customerId: string;
    principalOriginal: { toNumber?: () => number } | number | string;
    principalAtual: { toNumber?: () => number } | number | string;
    taxaJurosMensal: { toNumber?: () => number } | number | string;
    status: LoanStatus;
    dataInicio: Date;
    createdAt: Date;
    customer?: unknown;
  }) {
    return {
      ...loan,
      principalOriginal: toNumber(loan.principalOriginal),
      principalAtual: toNumber(loan.principalAtual),
      taxaJurosMensal: toNumber(loan.taxaJurosMensal),
    };
  }
}
