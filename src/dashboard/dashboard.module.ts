import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { LoansModule } from '../loans/loans.module';

@Module({
  imports: [LoansModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
