import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

/**
 * Custom Throttler Guard that skips rate limiting for:
 * - Swagger/OpenAPI endpoints (/docs, /docs-json, etc.)
 * - Metrics endpoints (/metrics)
 * - Health check endpoints
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    protected readonly options: any,
    protected readonly storageService: any,
    protected readonly reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path = request.url as string;
    const ip = String(request.ip || request.socket?.remoteAddress || '');
    const forwardedFor = String(request.headers['x-forwarded-for'] || '');
    const isDev = process.env.NODE_ENV !== 'production';

    // Skip throttling for local development traffic
    if (
      isDev &&
      (ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.endsWith('127.0.0.1') ||
        forwardedFor.includes('127.0.0.1') ||
        request.hostname === 'localhost')
    ) {
      return true;
    }

    // Skip throttling for Swagger/OpenAPI documentation
    if (
      path.startsWith('/docs') ||
      path.startsWith('/api-json') ||
      path.startsWith('/swagger') ||
      path.includes('swagger') ||
      path.includes('-json')
    ) {
      return true;
    }

    // Skip throttling for metrics endpoints (Prometheus)
    if (path.startsWith('/metrics')) {
      return true;
    }

    // Skip throttling for favicon
    if (path === '/favicon.ico') {
      return true;
    }

    // Check if route has @SkipThrottle decorator
    return super.shouldSkip(context);
  }
}
