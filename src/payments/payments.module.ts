import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { LoansModule } from '../loans/loans.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [LoansModule, AuditModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
