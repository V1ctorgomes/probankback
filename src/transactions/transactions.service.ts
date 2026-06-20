import { Injectable } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTransactionDto } from './dto/transaction.dto';
import { endOfDay, roundMoney, startOfDay, toNumber } from '../common/utils/money.util';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateTransactionDto, userId: string, ip?: string) {
    const transaction = await this.prisma.transaction.create({
      data: {
        tipo: dto.tipo,
        descricao: dto.descricao,
        categoryId: dto.categoryId,
        valor: dto.valor,
        data: new Date(dto.data),
        observacoes: dto.observacoes,
        userId,
      },
      include: { category: true },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'Transaction',
      entityId: transaction.id,
      ip,
    });

    return this.serialize(transaction);
  }

  async findAll(params: {
    startDate?: string;
    endDate?: string;
    tipo?: TransactionType;
  }) {
    const where: {
      data?: { gte?: Date; lte?: Date };
      tipo?: TransactionType;
    } = {};

    if (params.tipo) {
      where.tipo = params.tipo;
    }
    if (params.startDate || params.endDate) {
      where.data = {};
      if (params.startDate) {
        where.data.gte = startOfDay(new Date(params.startDate));
      }
      if (params.endDate) {
        where.data.lte = endOfDay(new Date(params.endDate));
      }
    }

    const items = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ data: 'desc' }, { createdAt: 'desc' }],
      include: { category: true },
    });

    const entradas = roundMoney(
      items
        .filter((item) => item.tipo === TransactionType.INCOME)
        .reduce((sum, item) => sum + toNumber(item.valor), 0),
    );
    const saidas = roundMoney(
      items
        .filter((item) => item.tipo === TransactionType.EXPENSE)
        .reduce((sum, item) => sum + toNumber(item.valor), 0),
    );

    return {
      items: items.map((item) => this.serialize(item)),
      resumo: {
        entradas,
        saidas,
        resultado: roundMoney(entradas - saidas),
      },
    };
  }

  serialize(transaction: {
    id: string;
    tipo: TransactionType;
    origem: string;
    descricao: string;
    valor: { toNumber?: () => number } | number | string;
    data: Date;
    observacoes: string | null;
    createdAt: Date;
    category?: { id: string; nome: string; tipo: string } | null;
  }) {
    return {
      id: transaction.id,
      tipo: transaction.tipo,
      origem: transaction.origem,
      descricao: transaction.descricao,
      valor: toNumber(transaction.valor),
      data: transaction.data,
      observacoes: transaction.observacoes,
      createdAt: transaction.createdAt,
      categoria: transaction.category?.nome ?? null,
    };
  }
}
