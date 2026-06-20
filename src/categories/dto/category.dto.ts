import { z } from 'zod';
import { CategoryType } from '@prisma/client';

export const createCategorySchema = z.object({
  nome: z.string().min(2),
  tipo: z.nativeEnum(CategoryType),
});

export const updateCategorySchema = z.object({
  nome: z.string().min(2).optional(),
  ativo: z.boolean().optional(),
});
