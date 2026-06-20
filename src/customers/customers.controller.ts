import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CustomersService } from './customers.service';
import {
  createCustomerSchema,
  updateCustomerSchema,
} from './dto/customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ClientIp,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  create(
    @Body(new ZodValidationPipe(createCustomerSchema))
    body: Parameters<CustomersService['create']>[0],
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.customersService.create(body, user.id, ip);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERADOR, UserRole.LEITURA)
  findAll(
    @Query('search') search?: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.customersService.findAll(search, onlyActive === 'true');
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERADOR, UserRole.LEITURA)
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema))
    body: Parameters<CustomersService['update']>[1],
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.customersService.update(id, body, user.id, ip);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.customersService.deactivate(id, user.id, ip);
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  activate(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.customersService.activate(id, user.id, ip);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.customersService.remove(id, user.id, ip);
  }
}
