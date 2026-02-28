import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class JobFollowUpDoc {
  @Prop()
  scheduledDate: Date;

  @Prop()
  completedDate: Date;

  @Prop({ enum: ['PENDING', 'COMPLETED', 'SKIPPED'], default: 'PENDING' })
  status: string;

  @Prop({ enum: ['EMAIL', 'PHONE', 'LINKEDIN', 'IN_PERSON', 'OTHER'] })
  type: string;

  @Prop()
  message: string;

  @Prop()
  response: string;
}

@Schema({ _id: false })
export class JobNoteDoc {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop()
  title: string;

  @Prop()
  content: string;

  @Prop({ default: false })
  isPinned: boolean;

  @Prop()
  category: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

@Schema({ _id: false })
export class JobTimelineEventDoc {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop()
  appliedDate: Date;

  @Prop()
  interview: Date;

  @Prop()
  offer: Date;

  @Prop()
  rejection: Date;

  @Prop()
  customEventDate: Date;

  @Prop()
  customEventName: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

@Schema({ _id: false })
export class JobDocumentDoc {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop()
  name: string;

  @Prop({
    enum: [
      'RESUME',
      'COVER_LETTER',
      'PORTFOLIO',
      'OFFER_LETTER',
      'CONTRACT',
      'OTHER',
    ],
  })
  type: string;

  @Prop()
  url: string;

  @Prop()
  fileKey: string;

  @Prop()
  mimeType: string;

  @Prop()
  size: number;

  @Prop({ default: 1 })
  version: number;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

@Schema({ _id: false })
export class JobReminderDoc {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({
    enum: [
      'FOLLOW_UP_DUE',
      'INTERVIEW_REMINDER',
      'OFFER_DEADLINE',
      'APPLICATION_DEADLINE',
      'CUSTOM',
    ],
  })
  reminderType: string;

  @Prop()
  scheduledAt: Date;

  @Prop()
  sentAt: Date;

  @Prop({
    enum: ['PENDING', 'SENT', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
  })
  status: string;

  @Prop({ enum: ['EMAIL', 'PUSH', 'SMS'], default: 'EMAIL' })
  channel: string;
}

@Schema({ collection: 'jobs' })
export class Job extends Document {
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true })
  authId: Types.ObjectId;

  // Company Information
  @Prop()
  companyName: string;

  @Prop()
  companyWebsite: string;

  @Prop()
  companyLinkedin: string;

  @Prop()
  companyLogoUrl: string;

  // Job Details
  @Prop()
  jobTitle: string;

  @Prop()
  jobDescription: string;

  @Prop()
  jobUrl: string;

  @Prop({ enum: ['REMOTE', 'HYBRID', 'ONSITE'], default: 'REMOTE' })
  locationType: string;

  @Prop()
  jobLocation: string;

  @Prop({
    enum: [
      'APPLIED',
      'SCREENING',
      'INTERVIEW',
      'OFFER',
      'REJECTED',
      'ACCEPTED',
      'DECLINED',
      'WITHDRAWN',
    ],
    default: 'APPLIED',
  })
  status: string;

  // Salary Information
  @Prop()
  minSalary: string;

  @Prop()
  maxSalary: string;

  @Prop()
  currency: string;

  // Contact Information
  @Prop()
  contactName: string;

  @Prop()
  contactEmail: string;

  @Prop()
  contactPhone: string;

  @Prop()
  hiringManagerLinkedin: string;

  // Application Details
  @Prop()
  appliedDate: Date;

  @Prop({
    enum: [
      'LINKEDIN',
      'INDEED',
      'COMPANY_WEBSITE',
      'REFERRAL',
      'RECRUITER',
      'JOB_BOARD',
      'CAREER_FAIR',
      'OTHER',
    ],
  })
  appliedVia: string;

  @Prop({
    enum: ['NO_RESPONSE', 'RESPONSE_RECEIVED', 'AWAITING_RESPONSE'],
    default: 'AWAITING_RESPONSE',
  })
  responseStatus: string;

  @Prop()
  responseDate: Date;

  @Prop()
  responseMessage: string;

  // Interview Details
  @Prop()
  interviewDate: Date;

  @Prop({
    enum: [
      'PHONE_SCREEN',
      'TECHNICAL',
      'BEHAVIORAL',
      'SYSTEM_DESIGN',
      'ONSITE',
      'PANEL',
      'FINAL',
      'OTHER',
    ],
  })
  interviewType: string;

  @Prop()
  interviewFeedback: string;

  @Prop()
  interviewerName: string;

  @Prop()
  interviewNotes: string;

  // Offer Details
  @Prop()
  offerDate: Date;

  @Prop()
  offerSalary: string;

  @Prop()
  offerBenefits: string;

  @Prop()
  offerDeadline: Date;

  @Prop()
  offerStatus: string;

  // Rejection Details
  @Prop()
  rejectionDate: Date;

  @Prop()
  rejectionReason: string;

  @Prop()
  rejectionFeedback: string;

  // AI Parsing Fields
  @Prop({
    enum: [
      'MANUAL',
      'AI_URL_PARSED',
      'AI_DESCRIPTION_PARSED',
      'IMPORTED',
      'EXTENSION',
    ],
    default: 'MANUAL',
  })
  sourceType: string;

  @Prop({ type: Object })
  aiParsedData: Record<string, any>;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [] })
  techStack: string[];

  // Priority and Other Fields
  @Prop({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' })
  priority: string;

  // Nested Documents
  @Prop({ type: [JobFollowUpDoc], default: [] })
  followUps: JobFollowUpDoc[];

  @Prop({ type: [JobNoteDoc], default: [] })
  notes: JobNoteDoc[];

  @Prop({ type: [JobTimelineEventDoc], default: [] })
  timeline: JobTimelineEventDoc[];

  @Prop({ type: [JobDocumentDoc], default: [] })
  documents: JobDocumentDoc[];

  @Prop({ type: [JobReminderDoc], default: [] })
  reminders: JobReminderDoc[];

  // Soft Delete
  @Prop({ type: Date, default: null })
  deletedAt: Date;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const JobSchema = SchemaFactory.createForClass(Job);
