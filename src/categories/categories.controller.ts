import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CategoriesService } from './categories.service';
import { createCategorySchema, updateCategorySchema } from './dto/category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ClientIp,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import type { AuthUser as AuthUserType } from '../common/decorators/current-user.decorator';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERADOR, UserRole.LEITURA)
  findAll() {
    return this.categoriesService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @Body(new ZodValidationPipe(createCategorySchema))
    body: { nome: string; tipo: 'INCOME' | 'EXPENSE' },
    @CurrentUser() user: AuthUserType,
    @ClientIp() ip: string,
  ) {
    return this.categoriesService.create(body, user.id, ip);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategorySchema))
    body: { nome?: string; ativo?: boolean },
    @CurrentUser() user: AuthUserType,
    @ClientIp() ip: string,
  ) {
    return this.categoriesService.update(id, body, user.id, ip);
  }
}
