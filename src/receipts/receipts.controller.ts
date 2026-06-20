import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ReceiptsService } from './receipts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERADOR, UserRole.LEITURA)
export class ReceiptsController {
  constructor(private receiptsService: ReceiptsService) {}

  @Get()
  getByMonth(
    @Query('month') month?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.receiptsService.getByMonth(
      month ?? new Date().toISOString().slice(0, 7),
      customerId,
    );
  }
}
