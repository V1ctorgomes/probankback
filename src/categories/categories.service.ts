import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.category.findMany({
      orderBy: [{ ativo: 'desc' }, { tipo: 'asc' }, { nome: 'asc' }],
    });
  }

  async create(
    data: { nome: string; tipo: 'INCOME' | 'EXPENSE' },
    userId: string,
    ip?: string,
  ) {
    const existing = await this.prisma.category.findFirst({
      where: { nome: data.nome, tipo: data.tipo },
    });
    if (existing) {
      throw new ConflictException('Categoria já cadastrada');
    }

    const category = await this.prisma.category.create({ data });
    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'Category',
      entityId: category.id,
      ip,
    });
    return category;
  }

  async update(
    id: string,
    data: { nome?: string; ativo?: boolean },
    userId: string,
    ip?: string,
  ) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'Category',
      entityId: id,
      ip,
    });

    return updated;
  }
}
