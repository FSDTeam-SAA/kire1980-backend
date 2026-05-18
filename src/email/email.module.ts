import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { EmailController } from './email.controller';

@Module({
  imports: [CommonModule],
  controllers: [EmailController],
})
export class EmailModule {}
