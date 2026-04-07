import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import config from '../config/app.config';
import { RedisService } from '../services/redis.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthUser } from '../../database/schemas';

interface IAccessTokenPayload {
  userId: string;
  role: string;
  tokenVersion: number;
}

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    @InjectModel(AuthUser.name) private authUserModel: Model<AuthUser>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      return true; // Allow access without token
    }

    try {
      const payload = jwt.verify(
        token,
        config.jwt_access_secret,
      ) as IAccessTokenPayload;

      // Soft version check
      const currentVersion = await this.getTokenVersion(payload.userId);

      if (currentVersion === payload.tokenVersion) {
        // Attach user to request ONLY if token is valid
        Object.assign(request, { user: payload });
      }

      return true; // Allow access even if token is invalid (it just won't be authenticated)
    } catch (error) {
      // Ignore token errors for OptionalAuthGuard
      return true;
    }
  }

  private async getTokenVersion(userId: string): Promise<number | null> {
    try {
      const cacheKey = `${config.redis_cache_key_prefix}:token_version:${userId}`;

      // Try Redis first
      const cachedVersion = await this.redisService.get<number>(cacheKey);
      if (cachedVersion !== null && cachedVersion !== undefined) {
        return cachedVersion;
      }

      // Fallback to DB
      const user = await this.authUserModel
        .findById(userId)
        .select('tokenVersion status')
        .lean()
        .exec();

      if (!user || user.status !== 'ACTIVE') {
        return null;
      }

      // Cache for 1 hour
      await this.redisService.set(cacheKey, user.tokenVersion, 3600);

      return user.tokenVersion;
    } catch (error) {
      return null;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
