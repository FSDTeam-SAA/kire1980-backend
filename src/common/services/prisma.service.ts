// DEPRECATED: This service is no longer used - migrated to Mongoose
// Keeping this file as a stub to avoid breaking imports

import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaService {
  constructor() {
    console.warn(
      'PrismaService is deprecated and no longer functional. Use Mongoose models instead.',
    );
  }
}
