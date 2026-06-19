import { z } from 'zod';

export const createCustomerSchema = z.object({
  nome: z.string().min(2),
  cpf: z.string().min(11).max(14),
  rg: z.string().optional(),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  endereco: z.string().optional(),
  observacoes: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
