import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmailService } from '../common/services/email.service';
import { TestEmailDto } from './dto/test-email.dto';

@ApiTags('email')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test')
  @ApiOperation({
    summary: 'Send a test email to verify SMTP credentials',
  })
  async testEmail(@Body() testEmailDto: TestEmailDto) {
    return this.emailService.sendTestEmail(testEmailDto.recipientEmail);
  }
}
