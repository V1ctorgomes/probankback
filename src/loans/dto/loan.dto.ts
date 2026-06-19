import { z } from 'zod';

export const createLoanSchema = z.object({
  customerId: z.string().uuid(),
  principalOriginal: z.number().positive(),
  taxaJurosMensal: z.number().min(0).max(1),
  dataInicio: z.string().datetime().or(z.string().date()),
});

export type CreateLoanDto = z.infer<typeof createLoanSchema>;
