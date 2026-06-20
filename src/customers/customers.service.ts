import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InterestService } from '../loans/interest.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { roundMoney, toNumber } from '../common/utils/money.util';
import { serializeInterestCycle } from '../common/utils/interest-cycle.util';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private interestService: InterestService,
  ) {}

  async create(dto: CreateCustomerDto, userId: string, ip?: string) {
    const existing = await this.prisma.customer.findUnique({
      where: { cpf: dto.cpf },
    });
    if (existing) {
      throw new ConflictException('CPF já cadastrado');
    }

    const customer = await this.prisma.customer.create({ data: dto });
    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'Customer',
      entityId: customer.id,
      ip,
    });
    return customer;
  }

  async findAll(search?: string, onlyActive = false) {
    const customers = await this.prisma.customer.findMany({
      where: {
        ...(onlyActive ? { ativo: true } : {}),
        ...(search
          ? {
              OR: [
                { nome: { contains: search, mode: 'insensitive' } },
                { cpf: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { nome: 'asc' },
      include: {
        _count: { select: { loans: true } },
      },
    });

    return Promise.all(
      customers.map(async ({ _count, ...customer }) => ({
        ...customer,
        saldoDevedor: await this.getCustomerDebt(customer.id),
        podeExcluir: _count.loans === 0,
      })),
    );
  }

  async getCustomerDebt(customerId: string) {
    const loans = await this.prisma.loan.findMany({
      where: { customerId, status: LoanStatus.ATIVO },
    });

    let total = 0;
    for (const loan of loans) {
      total += toNumber(loan.principalAtual);
      total += await this.interestService.getPendingInterest(loan.id);
    }

    return roundMoney(total);
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        loans: {
          orderBy: { createdAt: 'desc' },
          include: {
            payments: { orderBy: { createdAt: 'desc' }, take: 5 },
            interestCycles: { orderBy: { referencia: 'asc' } },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const saldoDevedor = await this.getCustomerDebt(id);
    const loans = await Promise.all(
      customer.loans.map(async (loan) => {
        await this.interestService.ensureCycles(loan.id);
        const jurosPendentes = await this.interestService.getPendingInterest(
          loan.id,
        );
        return {
          ...loan,
          principalOriginal: toNumber(loan.principalOriginal),
          principalAtual: toNumber(loan.principalAtual),
          taxaJurosMensal: toNumber(loan.taxaJurosMensal),
          jurosPendentes,
          interestCycles: loan.interestCycles
            .map((cycle) => serializeInterestCycle(cycle, loan.diaPagamento))
            .sort((left, right) => left.referencia.localeCompare(right.referencia)),
          payments: loan.payments.map((payment) => ({
            ...payment,
            valor: toNumber(payment.valor),
            jurosAbatido: toNumber(payment.jurosAbatido),
            principalAbatido: toNumber(payment.principalAbatido),
          })),
        };
      }),
    );

    return {
      ...customer,
      saldoDevedor,
      loans,
    };
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    userId: string,
    ip?: string,
  ) {
    await this.findOne(id);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: dto,
    });
    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'Customer',
      entityId: id,
      ip,
    });
    return customer;
  }

  async deactivate(id: string, userId: string, ip?: string) {
    await this.findOne(id);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: { ativo: false },
    });
    await this.auditService.log({
      userId,
      action: 'DEACTIVATE',
      entity: 'Customer',
      entityId: id,
      ip,
    });
    return customer;
  }

  async activate(id: string, userId: string, ip?: string) {
    await this.findOne(id);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: { ativo: true },
    });
    await this.auditService.log({
      userId,
      action: 'ACTIVATE',
      entity: 'Customer',
      entityId: id,
      ip,
    });
    return customer;
  }

  async remove(id: string, userId: string, ip?: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { loans: true } } },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    if (customer._count.loans > 0) {
      throw new BadRequestException(
        'Não é possível excluir cliente com empréstimos vinculados',
      );
    }

    await this.prisma.customer.delete({ where: { id } });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entity: 'Customer',
      entityId: id,
      ip,
    });

    return { ok: true };
  }
}
