import { Module } from '@nestjs/common';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';
import { InterestService } from './interest.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [LoansService, InterestService],
  controllers: [LoansController],
  exports: [LoansService, InterestService],
})
export class LoansModule {}
