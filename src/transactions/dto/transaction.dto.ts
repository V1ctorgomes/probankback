import { z } from 'zod';
import { TransactionType } from '@prisma/client';

export const createTransactionSchema = z.object({
  tipo: z.nativeEnum(TransactionType),
  descricao: z.string().min(2),
  categoryId: z.string().uuid().optional(),
  valor: z.number().positive(),
  data: z.string().min(1),
  observacoes: z.string().optional(),
});

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;
