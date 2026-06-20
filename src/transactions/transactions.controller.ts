import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { TransactionType, UserRole } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { createTransactionSchema } from './dto/transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ClientIp,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERADOR, UserRole.LEITURA)
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tipo') tipo?: TransactionType,
  ) {
    return this.transactionsService.findAll({ startDate, endDate, tipo });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  create(
    @Body(new ZodValidationPipe(createTransactionSchema))
    body: Parameters<TransactionsService['create']>[0],
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.transactionsService.create(body, user.id, ip);
  }
}
