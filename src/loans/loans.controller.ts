import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { LoanStatus, UserRole } from '@prisma/client';
import { LoansService } from './loans.service';
import { createLoanSchema } from './dto/loan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ClientIp,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(private loansService: LoansService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @UsePipes(new ZodValidationPipe(createLoanSchema))
  create(
    @Body() body: Parameters<LoansService['create']>[0],
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.loansService.create(body, user.id, ip);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERADOR, UserRole.LEITURA)
  findAll(@Query('status') status?: LoanStatus) {
    return this.loansService.findAll(status);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERADOR, UserRole.LEITURA)
  findOne(@Param('id') id: string) {
    return this.loansService.findOne(id);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  close(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.loansService.close(id, user.id, ip);
  }
}
