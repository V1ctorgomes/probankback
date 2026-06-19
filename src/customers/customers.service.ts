import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { toNumber } from '../common/utils/money.util';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
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

  async findAll(search?: string, includeInactive = false) {
    return this.prisma.customer.findMany({
      where: {
        ...(includeInactive ? {} : { ativo: true }),
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
    });
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

    return {
      ...customer,
      loans: customer.loans.map((loan) => ({
        ...loan,
        principalOriginal: toNumber(loan.principalOriginal),
        principalAtual: toNumber(loan.principalAtual),
        taxaJurosMensal: toNumber(loan.taxaJurosMensal),
      })),
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
}
