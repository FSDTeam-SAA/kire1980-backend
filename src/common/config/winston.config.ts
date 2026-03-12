import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import LokiTransport from 'winston-loki';

const isProduction = process.env.NODE_ENV === 'production';
// Enable Loki explicitly in development; keep enabled by default in production
const lokiEnabled =
  process.env.LOKI_ENABLED === undefined
    ? isProduction
    : process.env.LOKI_ENABLED === 'true';
const lokiHost =
  process.env.LOKI_URL ||
  (isProduction ? 'http://loki:3100' : 'http://localhost:3100');

const transports: winston.transport[] = [
  // Console transport for development
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, context, trace }) => {
        const traceValue =
          typeof trace === 'string' ? trace : JSON.stringify(trace, null, 2);
        const traceText = trace ? `\n${traceValue}` : '';
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-base-to-string
        return `${timestamp} [${context || 'Application'}] ${level}: ${message}${traceText}`;
      }),
    ),
  }),
];

// Only add Loki transport if enabled and not explicitly disabled
if (lokiEnabled) {
  try {
    transports.push(
      new LokiTransport({
        host: lokiHost,
        labels: {
          app: 'nestjs-app',
          environment: process.env.NODE_ENV || 'development',
        },
        json: true,
        format: winston.format.json(),
        replaceTimestamp: true,
        onConnectionError: (err) => {
          // Silently log connection errors to avoid spam
          if (process.env.NODE_ENV === 'development') {
            const errorMessage =
              err instanceof Error ? err.message : JSON.stringify(err, null, 2);
            console.error('Loki connection error:', errorMessage);
          }
        },
      }),
    );
  } catch (error) {
    console.warn('Failed to initialize Loki transport:', error);
  }
}

export const winstonConfig: WinstonModuleOptions = {
  transports,
  level: process.env.LOG_LEVEL || 'info',
  exitOnError: false,
};
