import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { createPaymentSchema } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ClientIp,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  create(
    @Body(new ZodValidationPipe(createPaymentSchema))
    body: Parameters<PaymentsService['create']>[0],
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.paymentsService.create(body, user.id, ip);
  }

  @Get('loan/:loanId')
  @Roles(UserRole.ADMIN, UserRole.OPERADOR, UserRole.LEITURA)
  findByLoan(@Param('loanId') loanId: string) {
    return this.paymentsService.findByLoan(loanId);
  }
}
