import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ContactInquiry,
  ContactInquirySchema,
} from '../database/schemas/contact-inquiry.schema';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { CommonModule } from '../common/common.module';
import { AuthUser, AuthUserSchema } from '../database/schemas/auth-user.schema';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: ContactInquiry.name, schema: ContactInquirySchema },
    ]),
  ],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
