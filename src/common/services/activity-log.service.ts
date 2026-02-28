import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityLogEvent } from '../../database/schemas';
import { CustomLoggerService } from './custom-logger.service';
import { ClientSession } from 'mongoose';

export interface ActivityLogMetadata {
  ip?: string;
  userAgent?: string;
  actionedBy?: string | null;
  device?: string;
}

export interface FieldChange {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectModel(ActivityLogEvent.name)
    private activityLogEventModel: Model<ActivityLogEvent>,
    private readonly customLogger: CustomLoggerService,
  ) {}

  /**
   * Log an activity event with field-level changes
   * Can be used within a transaction or standalone
   */
  async logActivity(
    params: {
      tableName: string;
      recordId: string;
      action: 'create' | 'update' | 'delete';
      eventType?:
        | 'create'
        | 'update'
        | 'delete'
        | 'login'
        | 'logout'
        | 'password_change'
        | 'profile_update';
      changes?: FieldChange[];
      metadata: ActivityLogMetadata;
    },
    session?: ClientSession,
  ) {
    const {
      tableName,
      recordId,
      action,
      eventType,
      changes = [],
      metadata,
    } = params;

    const createData: any = {
      tableName,
      recordId,
      action,
      eventType: eventType || action,
      actionedBy: metadata.actionedBy || null,
      ipAddress: metadata.ip,
      userAgent: metadata.userAgent,
      device: metadata.device,
      details: changes,
    };

    const options = session ? { session } : {};
    return await this.activityLogEventModel.create([createData], options);
  }

  /**
   * Log a create action
   */
  async logCreate(
    tableName: string,
    recordId: string,
    fields: Record<string, any>,
    metadata: ActivityLogMetadata,
    session?: ClientSession,
  ) {
    const changes: FieldChange[] = Object.entries(fields).map(
      ([key, value]) => ({
        fieldName: key,
        oldValue: null,
        newValue: String(value),
      }),
    );

    return this.logActivity(
      {
        tableName,
        recordId,
        action: 'create',
        eventType: 'create',
        changes,
        metadata,
      },
      session,
    );
  }

  /**
   * Log an update action
   */
  async logUpdate(
    tableName: string,
    recordId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    metadata: ActivityLogMetadata,
    session?: ClientSession,
  ) {
    const changes: FieldChange[] = [];

    // Find changed fields
    for (const [key, newValue] of Object.entries(newData)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const oldValue = oldData[key];
      if (oldValue !== newValue) {
        changes.push({
          fieldName: key,
          oldValue: oldValue != null ? String(oldValue) : null,
          newValue: newValue != null ? String(newValue) : null,
        });
      }
    }

    if (changes.length === 0) {
      return null; // No changes to log
    }

    return this.logActivity(
      {
        tableName,
        recordId,
        action: 'update',
        eventType: 'update',
        changes,
        metadata,
      },
      session,
    );
  }

  /**
   * Log a delete action
   */
  async logDelete(
    tableName: string,
    recordId: string,
    deletedData: Record<string, any>,
    metadata: ActivityLogMetadata,
    session?: ClientSession,
  ) {
    const changes: FieldChange[] = Object.entries(deletedData).map(
      ([key, value]) => ({
        fieldName: key,
        oldValue: String(value),
        newValue: null,
      }),
    );

    return this.logActivity(
      {
        tableName,
        recordId,
        action: 'delete',
        eventType: 'delete',
        changes,
        metadata,
      },
      session,
    );
  }

  /**
   * Log a custom event (login, logout, password change, etc.)
   */
  async logCustomEvent(
    tableName: string,
    recordId: string,
    eventType: 'login' | 'logout' | 'password_change' | 'profile_update',
    metadata: ActivityLogMetadata,
    changes?: FieldChange[],
    session?: ClientSession,
  ) {
    // Map eventType to action
    const actionMap = {
      login: 'update',
      logout: 'update',
      password_change: 'update',
      profile_update: 'update',
    };

    return this.logActivity(
      {
        tableName,
        recordId,
        action: actionMap[eventType] as 'create' | 'update' | 'delete',
        eventType,
        changes,
        metadata,
      },
      session,
    );
  }
}
