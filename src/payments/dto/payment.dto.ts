import { z } from 'zod';

export const createPaymentSchema = z.object({
  loanId: z.string().uuid(),
  valor: z.number().positive(),
});

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
