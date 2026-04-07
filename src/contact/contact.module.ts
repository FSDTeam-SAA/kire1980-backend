import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactInquiry, ContactInquirySchema } from '../database/schemas/contact-inquiry.schema';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { QueueModule } from '../common/modules/queue.module';
import { AuthUser, AuthUserSchema } from '../database/schemas/auth-user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactInquiry.name, schema: ContactInquirySchema },
      { name: AuthUser.name, schema: AuthUserSchema }, // Required for AuthGuard
    ]),
    QueueModule,
  ],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
