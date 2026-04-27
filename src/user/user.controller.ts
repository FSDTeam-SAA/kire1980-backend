import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Body,
  Patch,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
import { Types } from 'mongoose';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
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

  @ApiOperation({ summary: 'Get user by id (Admin or self)' })
  @ApiResponseDecorator(200, 'User retrieved successfully', User)
  @Get(':id')
  findOneById(
    @Param('id') id: string,
    @Request() req: { user: { userId: string; role: string } },
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id format');
    }

    if (req.user.role !== 'admin' && req.user.userId !== id) {
      throw new ForbiddenException('You can only access your own profile');
    }

    return this.userService.findOne(id);
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
    @Request() req: { user: { userId: string; role: string } },
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.userService.update(
      req.user.userId,
      updateUserDto,
      avatar,
      req.user.role,
    );
  }

  @ApiOperation({ summary: 'Update user by id (Admin or self)' })
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
  @Patch(':id')
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
  updateById(
    @Param('id') id: string,
    @Request() req: { user: { userId: string; role: string } },
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id format');
    }

    if (req.user.role !== 'admin' && req.user.userId !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    return this.userService.update(id, updateUserDto, avatar, req.user.role);
  }
}
