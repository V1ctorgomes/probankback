import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { AuditModule } from '../audit/audit.module';
import { LoansModule } from '../loans/loans.module';

@Module({
  imports: [AuditModule, LoansModule],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
