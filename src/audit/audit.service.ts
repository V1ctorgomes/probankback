import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  formatAuditDescription,
} from '../common/utils/audit-labels.util';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    ip?: string;
  }) {
    return this.prisma.auditLog.create({
      data: params,
    });
  }

  async findAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { nome: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        usuario: item.user?.nome ?? 'Sistema',
        acao: AUDIT_ACTION_LABELS[item.action] ?? item.action,
        registro: AUDIT_ENTITY_LABELS[item.entity] ?? item.entity,
        descricao: formatAuditDescription(item.action, item.entity),
      })),
      total,
      page,
      limit,
    };
  }
}
