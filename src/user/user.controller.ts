import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Body,
  Patch,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiResponseDecorator,
  ApiArrayResponseDecorator,
} from '../common/decorators';
import { User } from './entities/user.entity';
import { AuthGuard } from '../common/guards/auth.guard';

@ApiTags('users')
@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiArrayResponseDecorator(200, 'Users retrieved successfully', User)
  @Get()
  findAll(@Request() req: { user: { role: string } }) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can access all users');
    }
    return this.userService.findAll();
  }

  @ApiOperation({ summary: 'Get my profile' })
  @ApiResponseDecorator(200, 'User retrieved successfully', User)
  @Get('me')
  findMe(@Request() req: { user: { userId: string } }) {
    return this.userService.findOne(req.user.userId);
  }

  @ApiOperation({ summary: 'Update my profile (supports avatar image)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'User profile fields and optional avatar image file',
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        phoneNumber: { type: 'string' },
        country: { type: 'string' },
        city: { type: 'string' },
        postalCode: { type: 'number' },
        sector: { type: 'string' },
        avatar: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponseDecorator(200, 'User updated successfully', User)
  @Patch('me')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  updateMe(
    @Request() req: { user: { userId: string } },
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.userService.update(req.user.userId, updateUserDto, avatar);
  }
}
