import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PortalService } from './portal.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const lookupSchema = z.object({
  cpf: z.string().min(11),
});

@Controller('portal')
export class PortalController {
  constructor(private portalService: PortalService) {}

  @Post('lookup')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  lookup(@Body(new ZodValidationPipe(lookupSchema)) body: { cpf: string }) {
    return this.portalService.lookupByCpf(body.cpf);
  }
}
