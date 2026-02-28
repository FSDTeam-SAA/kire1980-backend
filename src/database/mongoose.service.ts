import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Connection, connect } from 'mongoose';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MongooseService implements OnModuleInit, OnApplicationShutdown {
  private logger = new Logger(MongooseService.name);
  private connection: Connection;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const mongoUri = this.configService.get<string>('DATABASE_URL');

    if (!mongoUri) {
      this.logger.error('DATABASE_URL environment variable is not set');
      throw new Error('DATABASE_URL environment variable is not set');
    }

    try {
      const mongoose = await connect(mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.connection = mongoose.connection;
      this.logger.log('MongoDB connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async onApplicationShutdown(signal?: string) {
    if (this.connection) {
      await this.connection.close();
      this.logger.log(`MongoDB connection closed due to ${signal}`);
    }
  }

  getConnection(): Connection {
    return this.connection;
  }

  async startSession() {
    return this.connection.startSession();
  }
}
