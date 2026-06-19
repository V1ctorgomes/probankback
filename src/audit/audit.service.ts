import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
          user: { select: { id: true, nome: true, email: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return { items, total, page, limit };
  }
}
