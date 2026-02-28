import { Schema, Prop, SchemaFactory, SubDocumentPath } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class ActivityLogEventDetail extends Document {
  @Prop()
  fieldName: string;

  @Prop()
  oldValue: string;

  @Prop()
  newValue: string;
}

@Schema({ collection: 'activity_log_events' })
export class ActivityLogEvent extends Document {
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true })
  actionedBy: Types.ObjectId;

  @Prop()
  tableName: string;

  @Prop()
  recordId: string;

  @Prop({
    enum: [
      'create',
      'update',
      'delete',
      'login',
      'logout',
      'password_change',
      'profile_update',
    ],
  })
  action: string;

  @Prop()
  ipAddress: string;

  @Prop()
  userAgent: string;

  @Prop()
  device: string;

  @Prop({ type: [ActivityLogEventDetail], default: [] })
  details: ActivityLogEventDetail[];

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const ActivityLogEventSchema =
  SchemaFactory.createForClass(ActivityLogEvent);
