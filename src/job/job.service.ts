import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Connection, ClientSession } from 'mongoose';
import { Job as JobDocument } from '../database/schemas';
import {
  ActivityLogService,
  ActivityLogMetadata,
} from '../common/services/activity-log.service';
import { CustomLoggerService } from '../common/services/custom-logger.service';
import {
  CreateJobDto,
  UpdateJobDto,
  JobFilterDto,
  CreateJobFollowUpDto,
  UpdateJobFollowUpDto,
  CompleteJobFollowUpDto,
  CreateJobNoteDto,
  UpdateJobNoteDto,
} from './dto';
import {
  JobStatus,
  ResponseStatus,
  JobTimelineEventType,
  FollowUpStatus,
} from './enums';

@Injectable()
export class JobService {
  constructor(
    @InjectModel(JobDocument.name) private jobModel: Model<JobDocument>,
    private readonly activityLogService: ActivityLogService,
    private readonly customLogger: CustomLoggerService,
    private readonly connection: Connection,
  ) {}

  // ================================
  // Job CRUD Operations
  // ================================

  /**
   * Create a new job application
   */
  async createJob(
    authId: string,
    createJobDto: CreateJobDto,
    meta: ActivityLogMetadata,
  ) {
    this.customLogger.log(
      `Creating job application for user: ${authId}, company: ${createJobDto.company}`,
      'JobService',
    );

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Create the job
      const newJob = await this.jobModel.create(
        [
          {
            authId,
            company: createJobDto.company,
            companyUrl: createJobDto.companyUrl,
            companyLinkedin: createJobDto.companyLinkedin,
            companyFacebook: createJobDto.companyFacebook,
            companyTwitter: createJobDto.companyTwitter,
            companyLogo: createJobDto.companyLogo,
            role: createJobDto.role,
            location: createJobDto.location,
            locationType: createJobDto.locationType,
            salaryDisplay: createJobDto.salaryDisplay,
            salaryMin: createJobDto.salaryMin,
            salaryMax: createJobDto.salaryMax,
            salaryCurrency: createJobDto.salaryCurrency || 'USD',
            contactPerson: createJobDto.contactPerson,
            contactEmail: createJobDto.contactEmail,
            contactPhone: createJobDto.contactPhone,
            appliedDate: new Date(createJobDto.appliedDate),
            appliedVia: createJobDto.appliedVia,
            jobPostingUrl: createJobDto.jobPostingUrl,
            status: createJobDto.status || 'APPLIED',
            responseStatus: createJobDto.responseStatus || 'NO_RESPONSE',
            responseDate: createJobDto.responseDate
              ? new Date(createJobDto.responseDate)
              : null,
            techStack: createJobDto.techStack || [],
            jobDescription: createJobDto.jobDescription,
            requirements: createJobDto.requirements,
            responsibilities: createJobDto.responsibilities,
            benefits: createJobDto.benefits,
            interviewScheduled: createJobDto.interviewScheduled || false,
            interviewDate: createJobDto.interviewDate
              ? new Date(createJobDto.interviewDate)
              : null,
            interviewType: createJobDto.interviewType,
            interviewRound: createJobDto.interviewRound,
            interviewLocation: createJobDto.interviewLocation,
            interviewNotes: createJobDto.interviewNotes,
            priority: createJobDto.priority || 'MEDIUM',
            tags: createJobDto.tags || [],
            isFavorite: createJobDto.isFavorite || false,
            isArchived: createJobDto.isArchived || false,
            offerAmount: createJobDto.offerAmount,
            offerDate: createJobDto.offerDate
              ? new Date(createJobDto.offerDate)
              : null,
            offerDeadline: createJobDto.offerDeadline
              ? new Date(createJobDto.offerDeadline)
              : null,
            offerNotes: createJobDto.offerNotes,
            rejectionReason: createJobDto.rejectionReason,
            rejectionDate: createJobDto.rejectionDate
              ? new Date(createJobDto.rejectionDate)
              : null,
            notes: createJobDto.notes,
            aiParsedData: createJobDto.aiParsedData,
            aiConfidenceScore: createJobDto.aiConfidenceScore,
            sourceType: createJobDto.sourceType || 'MANUAL',
            rawJobPosting: createJobDto.rawJobPosting,
            nextFollowUpDate: createJobDto.nextFollowUpDate
              ? new Date(createJobDto.nextFollowUpDate)
              : null,
            timeline: [
              {
                eventType: 'APPLIED',
                title: 'Application Submitted',
                description: `Applied to ${createJobDto.company} for ${createJobDto.role} position via ${createJobDto.appliedVia}`,
                metadata: {
                  appliedVia: createJobDto.appliedVia,
                  location: createJobDto.location,
                  locationType: createJobDto.locationType,
                },
              },
            ],
          },
        ],
        { session },
      );

      const jobId = newJob[0]._id.toString();
      const jobData: any = newJob[0].toObject();

      // Log activity
      await this.activityLogService.logCreate(
        'Job',
        jobId,
        {
          company: jobData.company,
          role: jobData.role,
          location: jobData.location,
          status: jobData.status,
          appliedVia: jobData.appliedVia,
        },
        { ...meta, actionedBy: authId },
        session,
      );

      await session.commitTransaction();

      this.customLogger.log(
        `Job application created successfully: ${jobId}`,
        'JobService',
      );

      return newJob[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get all jobs for a user with filtering, pagination, and sorting
   */
  async findAllJobs(authId: string, filterDto: JobFilterDto) {
    const {
      search,
      status,
      responseStatus,
      priority,
      locationType,
      location,
      appliedVia,
      appliedDateFrom,
      appliedDateTo,
      responseDateFrom,
      responseDateTo,
      salaryMinFrom,
      salaryMaxTo,
      isFavorite,
      isArchived,
      interviewScheduled,
      tags,
      techStack,
      company,
      page = 1,
      limit = 20,
      sortBy = 'appliedDate',
      sortOrder = 'desc',
    } = filterDto;

    // Build MongoDB query
    const query: any = {
      authId,
      deletedAt: null, // Exclude soft-deleted jobs
    };

    // Search across multiple fields
    if (search) {
      query.$or = [
        { company: { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { techStack: { $elemMatch: { $in: [search] } } },
        { tags: { $elemMatch: { $in: [search] } } },
      ];
    }

    // Status filters
    if (status && status.length > 0) {
      query.status = { $in: status };
    }

    if (responseStatus && responseStatus.length > 0) {
      query.responseStatus = { $in: responseStatus };
    }

    if (priority && priority.length > 0) {
      query.priority = { $in: priority };
    }

    if (locationType && locationType.length > 0) {
      query.locationType = { $in: locationType };
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    if (appliedVia && appliedVia.length > 0) {
      query.appliedVia = { $in: appliedVia };
    }

    // Date filters
    if (appliedDateFrom || appliedDateTo) {
      query.appliedDate = {};
      if (appliedDateFrom) {
        query.appliedDate.$gte = new Date(appliedDateFrom);
      }
      if (appliedDateTo) {
        query.appliedDate.$lte = new Date(appliedDateTo);
      }
    }

    if (responseDateFrom || responseDateTo) {
      query.responseDate = {};
      if (responseDateFrom) {
        query.responseDate.$gte = new Date(responseDateFrom);
      }
      if (responseDateTo) {
        query.responseDate.$lte = new Date(responseDateTo);
      }
    }

    // Salary filters
    if (salaryMinFrom !== undefined) {
      query.salaryMin = { $gte: salaryMinFrom };
    }

    if (salaryMaxTo !== undefined) {
      query.salaryMax = { $lte: salaryMaxTo };
    }

    // Boolean filters
    if (isFavorite !== undefined) {
      query.isFavorite = isFavorite;
    }

    if (isArchived !== undefined) {
      query.isArchived = isArchived;
    }

    if (interviewScheduled !== undefined) {
      query.interviewScheduled = interviewScheduled;
    }

    // Array filters
    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    if (techStack && techStack.length > 0) {
      query.techStack = { $in: techStack };
    }

    if (company) {
      query.company = { $regex: company, $options: 'i' };
    }

    // Build sort
    const sort: any = {};
    const validSortFields = [
      'appliedDate',
      'company',
      'status',
      'salaryMax',
      'salaryMin',
      'responseDate',
      'createdAt',
      'updatedAt',
      'priority',
      'role',
    ];

    if (validSortFields.includes(sortBy)) {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.appliedDate = -1;
    }

    // Execute queries
    const [jobs, total] = await Promise.all([
      this.jobModel
        .find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.jobModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: jobs,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get a single job by ID
   */
  async findJobById(
    authId: string,
    jobId: string,
    includeRelations = false,
  ): Promise<any> {
    const job = await this.jobModel.findById(jobId).lean().exec();

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.authId.toString() !== authId) {
      throw new NotFoundException('You do not have access to this job');
    }

    if (job.deletedAt) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  /**
   * Update a job
   */
  async updateJob(
    authId: string,
    jobId: string,
    updateJobDto: UpdateJobDto,
    meta: ActivityLogMetadata,
  ) {
    // Get existing job
    const existingJob = await this.findJobById(authId, jobId);

    this.customLogger.log(
      `Updating job: ${jobId} for user: ${authId}`,
      'JobService',
    );

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Prepare update data
      const updateData: any = {};

      // Map all fields from DTO
      if (updateJobDto.company !== undefined)
        updateData.company = updateJobDto.company;
      if (updateJobDto.companyUrl !== undefined)
        updateData.companyUrl = updateJobDto.companyUrl;
      if (updateJobDto.companyLinkedin !== undefined)
        updateData.companyLinkedin = updateJobDto.companyLinkedin;
      if (updateJobDto.companyFacebook !== undefined)
        updateData.companyFacebook = updateJobDto.companyFacebook;
      if (updateJobDto.companyTwitter !== undefined)
        updateData.companyTwitter = updateJobDto.companyTwitter;
      if (updateJobDto.companyLogo !== undefined)
        updateData.companyLogo = updateJobDto.companyLogo;
      if (updateJobDto.role !== undefined) updateData.role = updateJobDto.role;
      if (updateJobDto.location !== undefined)
        updateData.location = updateJobDto.location;
      if (updateJobDto.locationType !== undefined)
        updateData.locationType = updateJobDto.locationType;
      if (updateJobDto.salaryDisplay !== undefined)
        updateData.salaryDisplay = updateJobDto.salaryDisplay;
      if (updateJobDto.salaryMin !== undefined)
        updateData.salaryMin = updateJobDto.salaryMin;
      if (updateJobDto.salaryMax !== undefined)
        updateData.salaryMax = updateJobDto.salaryMax;
      if (updateJobDto.salaryCurrency !== undefined)
        updateData.salaryCurrency = updateJobDto.salaryCurrency;
      if (updateJobDto.contactPerson !== undefined)
        updateData.contactPerson = updateJobDto.contactPerson;
      if (updateJobDto.contactEmail !== undefined)
        updateData.contactEmail = updateJobDto.contactEmail;
      if (updateJobDto.contactPhone !== undefined)
        updateData.contactPhone = updateJobDto.contactPhone;
      if (updateJobDto.appliedDate !== undefined)
        updateData.appliedDate = new Date(updateJobDto.appliedDate);
      if (updateJobDto.appliedVia !== undefined)
        updateData.appliedVia = updateJobDto.appliedVia;
      if (updateJobDto.jobPostingUrl !== undefined)
        updateData.jobPostingUrl = updateJobDto.jobPostingUrl;
      if (updateJobDto.responseDate !== undefined)
        updateData.responseDate = new Date(updateJobDto.responseDate);
      if (updateJobDto.techStack !== undefined)
        updateData.techStack = updateJobDto.techStack;
      if (updateJobDto.jobDescription !== undefined)
        updateData.jobDescription = updateJobDto.jobDescription;
      if (updateJobDto.requirements !== undefined)
        updateData.requirements = updateJobDto.requirements;
      if (updateJobDto.responsibilities !== undefined)
        updateData.responsibilities = updateJobDto.responsibilities;
      if (updateJobDto.benefits !== undefined)
        updateData.benefits = updateJobDto.benefits;
      if (updateJobDto.interviewScheduled !== undefined)
        updateData.interviewScheduled = updateJobDto.interviewScheduled;
      if (updateJobDto.interviewDate !== undefined)
        updateData.interviewDate = new Date(updateJobDto.interviewDate);
      if (updateJobDto.interviewType !== undefined)
        updateData.interviewType = updateJobDto.interviewType;
      if (updateJobDto.interviewRound !== undefined)
        updateData.interviewRound = updateJobDto.interviewRound;
      if (updateJobDto.interviewLocation !== undefined)
        updateData.interviewLocation = updateJobDto.interviewLocation;
      if (updateJobDto.interviewNotes !== undefined)
        updateData.interviewNotes = updateJobDto.interviewNotes;
      if (updateJobDto.priority !== undefined)
        updateData.priority = updateJobDto.priority;
      if (updateJobDto.tags !== undefined) updateData.tags = updateJobDto.tags;
      if (updateJobDto.isFavorite !== undefined)
        updateData.isFavorite = updateJobDto.isFavorite;
      if (updateJobDto.isArchived !== undefined)
        updateData.isArchived = updateJobDto.isArchived;
      if (updateJobDto.offerAmount !== undefined)
        updateData.offerAmount = updateJobDto.offerAmount;
      if (updateJobDto.offerDate !== undefined)
        updateData.offerDate = new Date(updateJobDto.offerDate);
      if (updateJobDto.offerDeadline !== undefined)
        updateData.offerDeadline = new Date(updateJobDto.offerDeadline);
      if (updateJobDto.offerNotes !== undefined)
        updateData.offerNotes = updateJobDto.offerNotes;
      if (updateJobDto.rejectionReason !== undefined)
        updateData.rejectionReason = updateJobDto.rejectionReason;
      if (updateJobDto.rejectionDate !== undefined)
        updateData.rejectionDate = new Date(updateJobDto.rejectionDate);
      if (updateJobDto.notes !== undefined)
        updateData.notes = updateJobDto.notes;
      if (updateJobDto.aiParsedData !== undefined)
        updateData.aiParsedData = updateJobDto.aiParsedData;
      if (updateJobDto.aiConfidenceScore !== undefined)
        updateData.aiConfidenceScore = updateJobDto.aiConfidenceScore;
      if (updateJobDto.sourceType !== undefined)
        updateData.sourceType = updateJobDto.sourceType;
      if (updateJobDto.rawJobPosting !== undefined)
        updateData.rawJobPosting = updateJobDto.rawJobPosting;
      if (updateJobDto.nextFollowUpDate !== undefined)
        updateData.nextFollowUpDate = new Date(updateJobDto.nextFollowUpDate);
      if (updateJobDto.followUpCount !== undefined)
        updateData.followUpCount = updateJobDto.followUpCount;
      if (updateJobDto.lastFollowUpDate !== undefined)
        updateData.lastFollowUpDate = new Date(updateJobDto.lastFollowUpDate);

      // Handle status change with timeline event
      if (
        updateJobDto.status !== undefined &&
        updateJobDto.status !== existingJob.status
      ) {
        updateData.status = updateJobDto.status;

        // Add timeline event for status change
        const timelineEvent = {
          eventType: this.mapStatusToTimelineEvent(updateJobDto.status),
          title: `Status changed to ${updateJobDto.status}`,
          description: `Job status changed from ${existingJob.status} to ${updateJobDto.status}`,
          metadata: {
            previousStatus: existingJob.status,
            newStatus: updateJobDto.status,
          },
          createdAt: new Date(),
        };

        await this.jobModel.findByIdAndUpdate(
          jobId,
          { $push: { timeline: timelineEvent } },
          { session },
        );
      }

      // Handle response status change with timeline event
      if (
        updateJobDto.responseStatus !== undefined &&
        updateJobDto.responseStatus !== existingJob.responseStatus
      ) {
        updateData.responseStatus = updateJobDto.responseStatus;

        if (updateJobDto.responseStatus === ResponseStatus.RESPONSE_RECEIVED) {
          const timelineEvent = {
            eventType: JobTimelineEventType.RESPONSE_RECEIVED,
            title: 'Response Received',
            description: `Received a response from ${existingJob.company}`,
            createdAt: new Date(),
          };

          await this.jobModel.findByIdAndUpdate(
            jobId,
            { $push: { timeline: timelineEvent } },
            { session },
          );
        }
      }

      // Handle interview scheduled
      if (
        updateJobDto.interviewScheduled &&
        !existingJob.interviewScheduled &&
        updateJobDto.interviewDate
      ) {
        const timelineEvent = {
          eventType: JobTimelineEventType.INTERVIEW,
          title: 'Interview Scheduled',
          description: `Interview scheduled for ${new Date(updateJobDto.interviewDate).toLocaleDateString()}`,
          metadata: {
            interviewDate: updateJobDto.interviewDate,
            interviewType: updateJobDto.interviewType,
            interviewRound: updateJobDto.interviewRound,
          },
          createdAt: new Date(),
        };

        await this.jobModel.findByIdAndUpdate(
          jobId,
          { $push: { timeline: timelineEvent } },
          { session },
        );
      }

      // Update the job
      const updatedJob = await this.jobModel
        .findByIdAndUpdate(jobId, { $set: updateData }, { session, new: true })
        .lean()
        .exec();

      // Log activity
      await this.activityLogService.logUpdate(
        'Job',
        jobId,
        existingJob,
        updatedJob,
        { ...meta, actionedBy: authId },
        session,
      );

      await session.commitTransaction();

      this.customLogger.log(`Job updated successfully: ${jobId}`, 'JobService');

      return updatedJob;
    } catch (error) {
      await session.abortTransaction();
      this.customLogger.error(
        `Failed to update job: ${jobId}`,
        error.stack,
        'JobService',
      );
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Soft delete a job
   */
  async deleteJob(authId: string, jobId: string, meta: ActivityLogMetadata) {
    const existingJob = await this.findJobById(authId, jobId);

    this.customLogger.log(
      `Soft deleting job: ${jobId} for user: ${authId}`,
      'JobService',
    );

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      await this.jobModel.findByIdAndUpdate(
        jobId,
        { $set: { deletedAt: new Date() } },
        { session },
      );

      await this.activityLogService.logDelete(
        'Job',
        jobId,
        { company: existingJob.company, role: existingJob.role },
        { ...meta, actionedBy: authId },
        session,
      );

      await session.commitTransaction();
      return { message: 'Job deleted successfully' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Permanently delete a job (admin only or cleanup)
   */
  async hardDeleteJob(authId: string, jobId: string) {
    const existingJob = await this.jobModel.findById(jobId).lean().exec();

    if (!existingJob || existingJob.authId.toString() !== authId) {
      throw new NotFoundException('Job not found');
    }

    await this.jobModel.findByIdAndDelete(jobId).exec();

    return { message: 'Job permanently deleted' };
  }

  /**
   * Archive/Unarchive a job
   */
  async toggleArchiveJob(
    authId: string,
    jobId: string,
    meta: ActivityLogMetadata,
  ) {
    const existingJob = await this.findJobById(authId, jobId);

    const updatedJob = await this.jobModel
      .findByIdAndUpdate(
        jobId,
        { $set: { isArchived: !existingJob.isArchived } },
        { new: true },
      )
      .lean()
      .exec();

    return updatedJob;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavoriteJob(authId: string, jobId: string) {
    const existingJob = await this.findJobById(authId, jobId);

    const updatedJob = await this.jobModel
      .findByIdAndUpdate(
        jobId,
        { $set: { isFavorite: !existingJob.isFavorite } },
        { new: true },
      )
      .lean()
      .exec();

    return updatedJob;
  }

  /**
   * Bulk archive jobs
   */
  async bulkArchiveJobs(authId: string, jobIds: string[]) {
    // Verify all jobs belong to user
    const jobs = await this.jobModel
      .find({
        _id: { $in: jobIds },
        authId,
        deletedAt: null,
      })
      .lean()
      .exec();

    if (jobs.length !== jobIds.length) {
      throw new ForbiddenException(
        'Some jobs were not found or you do not have access',
      );
    }

    await this.jobModel
      .updateMany({ _id: { $in: jobIds } }, { $set: { isArchived: true } })
      .exec();

    return { message: `${jobIds.length} jobs archived successfully` };
  }

  /**
   * Bulk delete jobs (soft delete)
   */
  async bulkDeleteJobs(authId: string, jobIds: string[]) {
    const jobs = await this.jobModel
      .find({
        _id: { $in: jobIds },
        authId,
        deletedAt: null,
      })
      .lean()
      .exec();

    if (jobs.length !== jobIds.length) {
      throw new ForbiddenException(
        'Some jobs were not found or you do not have access',
      );
    }

    await this.jobModel
      .updateMany({ _id: { $in: jobIds } }, { $set: { deletedAt: new Date() } })
      .exec();

    return { message: `${jobIds.length} jobs deleted successfully` };
  }

  // ================================
  // Follow-Up Operations
  // ================================

  /**
   * Create a follow-up for a job
   */
  async createFollowUp(
    authId: string,
    jobId: string,
    createFollowUpDto: CreateJobFollowUpDto,
  ) {
    const job = await this.findJobById(authId, jobId);

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const newFollowUp = {
        scheduledDate: new Date(createFollowUpDto.scheduledDate),
        type: createFollowUpDto.type,
        subject: createFollowUpDto.subject,
        message: createFollowUpDto.message,
        status: FollowUpStatus.PENDING,
        createdAt: new Date(),
      };

      // Add follow-up to job's followUps array and timeline
      const timelineEvent = {
        eventType: JobTimelineEventType.FOLLOW_UP,
        title: 'Follow-up Scheduled',
        description: `${createFollowUpDto.type} follow-up scheduled for ${new Date(createFollowUpDto.scheduledDate).toLocaleDateString()}`,
        metadata: { type: createFollowUpDto.type },
        createdAt: new Date(),
      };

      const updatedJob = await this.jobModel
        .findByIdAndUpdate(
          jobId,
          {
            $push: {
              followUps: newFollowUp,
              timeline: timelineEvent,
            },
            $set: { nextFollowUpDate: newFollowUp.scheduledDate },
          },
          { session, new: true },
        )
        .lean()
        .exec();

      await session.commitTransaction();
      return updatedJob.followUps[updatedJob.followUps.length - 1];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get all follow-ups for a job
   */
  async getFollowUps(authId: string, jobId: string) {
    const job = await this.findJobById(authId, jobId);
    return job.followUps || [];
  }

  /**
   * Update a follow-up
   */
  async updateFollowUp(
    authId: string,
    jobId: string,
    followUpId: string,
    updateFollowUpDto: UpdateJobFollowUpDto,
  ) {
    const job = await this.findJobById(authId, jobId);

    const followUpIndex = job.followUps?.findIndex(
      (f) => f._id?.toString() === followUpId,
    );

    if (followUpIndex === -1 || followUpIndex === undefined) {
      throw new NotFoundException('Follow-up not found');
    }

    const updateFields: any = {};
    if (updateFollowUpDto.scheduledDate)
      updateFields[`followUps.${followUpIndex}.scheduledDate`] = new Date(
        updateFollowUpDto.scheduledDate,
      );
    if (updateFollowUpDto.completedDate)
      updateFields[`followUps.${followUpIndex}.completedDate`] = new Date(
        updateFollowUpDto.completedDate,
      );
    if (updateFollowUpDto.status)
      updateFields[`followUps.${followUpIndex}.status`] =
        updateFollowUpDto.status;
    if (updateFollowUpDto.type)
      updateFields[`followUps.${followUpIndex}.type`] = updateFollowUpDto.type;
    if (updateFollowUpDto.subject)
      updateFields[`followUps.${followUpIndex}.subject`] =
        updateFollowUpDto.subject;
    if (updateFollowUpDto.message)
      updateFields[`followUps.${followUpIndex}.message`] =
        updateFollowUpDto.message;
    if (updateFollowUpDto.response)
      updateFields[`followUps.${followUpIndex}.response`] =
        updateFollowUpDto.response;

    const updatedJob = await this.jobModel
      .findByIdAndUpdate(jobId, { $set: updateFields }, { new: true })
      .lean()
      .exec();

    return updatedJob.followUps[followUpIndex];
  }

  /**
   * Complete a follow-up
   */
  async completeFollowUp(
    authId: string,
    jobId: string,
    followUpId: string,
    completeDto: CompleteJobFollowUpDto,
  ) {
    const job = await this.findJobById(authId, jobId);

    const followUpIndex = job.followUps?.findIndex(
      (f) => f._id?.toString() === followUpId,
    );

    if (followUpIndex === -1 || followUpIndex === undefined) {
      throw new NotFoundException('Follow-up not found');
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const updateFields = {
        [`followUps.${followUpIndex}.status`]:
          completeDto.status || FollowUpStatus.COMPLETED,
        [`followUps.${followUpIndex}.completedDate`]: new Date(),
        [`followUps.${followUpIndex}.response`]: completeDto.response,
        followUpCount: (job.followUpCount || 0) + 1,
        lastFollowUpDate: new Date(),
      };

      const updatedJob = await this.jobModel
        .findByIdAndUpdate(
          jobId,
          { $set: updateFields },
          { session, new: true },
        )
        .lean()
        .exec();

      await session.commitTransaction();
      return updatedJob.followUps[followUpIndex];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Delete a follow-up
   */
  async deleteFollowUp(authId: string, jobId: string, followUpId: string) {
    const job = await this.findJobById(authId, jobId);

    const followUpExists = job.followUps?.some(
      (f) => f._id?.toString() === followUpId,
    );

    if (!followUpExists) {
      throw new NotFoundException('Follow-up not found');
    }

    await this.jobModel
      .findByIdAndUpdate(jobId, {
        $pull: { followUps: { _id: followUpId } },
      })
      .exec();

    return { message: 'Follow-up deleted successfully' };
  }

  // ================================
  // Note Operations
  // ================================

  /**
   * Create a note for a job
   */
  async createNote(
    authId: string,
    jobId: string,
    createNoteDto: CreateJobNoteDto,
  ) {
    await this.findJobById(authId, jobId);

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const newNote = {
        title: createNoteDto.title,
        content: createNoteDto.content,
        isPinned: createNoteDto.isPinned || false,
        category: createNoteDto.category,
        createdAt: new Date(),
      };

      const timelineEvent = {
        eventType: JobTimelineEventType.NOTE_ADDED,
        title: 'Note Added',
        description: createNoteDto.title,
        metadata: { category: createNoteDto.category },
        createdAt: new Date(),
      };

      const updatedJob = await this.jobModel
        .findByIdAndUpdate(
          jobId,
          {
            $push: {
              notes: newNote,
              timeline: timelineEvent,
            },
          },
          { session, new: true },
        )
        .lean()
        .exec();

      await session.commitTransaction();
      return updatedJob.notes[updatedJob.notes.length - 1];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get all notes for a job
   */
  async getNotes(authId: string, jobId: string) {
    const job = await this.findJobById(authId, jobId);
    const notes = job.notes || [];
    // Sort by isPinned (desc) then createdAt (desc)
    return notes.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  /**
   * Update a note
   */
  async updateNote(
    authId: string,
    jobId: string,
    noteId: string,
    updateNoteDto: UpdateJobNoteDto,
  ) {
    const job = await this.findJobById(authId, jobId);

    const noteIndex = job.notes?.findIndex((n) => n._id?.toString() === noteId);

    if (noteIndex === -1 || noteIndex === undefined) {
      throw new NotFoundException('Note not found');
    }

    const updateFields: any = {};
    if (updateNoteDto.title)
      updateFields[`notes.${noteIndex}.title`] = updateNoteDto.title;
    if (updateNoteDto.content)
      updateFields[`notes.${noteIndex}.content`] = updateNoteDto.content;
    if (updateNoteDto.isPinned !== undefined)
      updateFields[`notes.${noteIndex}.isPinned`] = updateNoteDto.isPinned;
    if (updateNoteDto.category)
      updateFields[`notes.${noteIndex}.category`] = updateNoteDto.category;

    const updatedJob = await this.jobModel
      .findByIdAndUpdate(jobId, { $set: updateFields }, { new: true })
      .lean()
      .exec();

    return updatedJob.notes[noteIndex];
  }

  /**
   * Toggle pin status of a note
   */
  async togglePinNote(authId: string, jobId: string, noteId: string) {
    const job = await this.findJobById(authId, jobId);

    const noteIndex = job.notes?.findIndex((n) => n._id?.toString() === noteId);

    if (noteIndex === -1 || noteIndex === undefined) {
      throw new NotFoundException('Note not found');
    }

    const currentPinStatus = job.notes[noteIndex].isPinned;

    const updatedJob = await this.jobModel
      .findByIdAndUpdate(
        jobId,
        { $set: { [`notes.${noteIndex}.isPinned`]: !currentPinStatus } },
        { new: true },
      )
      .lean()
      .exec();

    return updatedJob.notes[noteIndex];
  }

  /**
   * Delete a note
   */
  async deleteNote(authId: string, jobId: string, noteId: string) {
    const job = await this.findJobById(authId, jobId);

    const noteExists = job.notes?.some((n) => n._id?.toString() === noteId);

    if (!noteExists) {
      throw new NotFoundException('Note not found');
    }

    await this.jobModel
      .findByIdAndUpdate(jobId, {
        $pull: { notes: { _id: noteId } },
      })
      .exec();

    return { message: 'Note deleted successfully' };
  }

  // ================================
  // Timeline Operations
  // ================================

  /**
   * Get timeline for a job
   */
  async getTimeline(authId: string, jobId: string) {
    const job = await this.findJobById(authId, jobId);
    const timeline = job.timeline || [];
    // Sort by createdAt descending
    return timeline.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Add custom timeline event
   */
  async addTimelineEvent(
    authId: string,
    jobId: string,
    title: string,
    description?: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.findJobById(authId, jobId);

    const timelineEvent = {
      eventType: JobTimelineEventType.OTHER,
      title,
      description,
      metadata,
      createdAt: new Date(),
    };

    const updatedJob = await this.jobModel
      .findByIdAndUpdate(
        jobId,
        { $push: { timeline: timelineEvent } },
        { new: true },
      )
      .lean()
      .exec();

    return updatedJob.timeline[updatedJob.timeline.length - 1];
  }

  // ================================
  // Statistics Operations
  // ================================

  /**
   * Get job statistics for a user
   */
  async getStatistics(authId: string) {
    const baseQuery = { authId, deletedAt: null };
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalJobs,
      byStatus,
      byResponseStatus,
      byLocationType,
      byPriority,
      byAppliedVia,
      applicationsThisWeek,
      applicationsThisMonth,
      responsesThisWeek,
      interviewsScheduled,
      salaryStats,
    ] = await Promise.all([
      // Total jobs
      this.jobModel.countDocuments(baseQuery),

      // By status - using aggregation
      this.jobModel.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // By response status
      this.jobModel.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$responseStatus', count: { $sum: 1 } } },
      ]),

      // By location type
      this.jobModel.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$locationType', count: { $sum: 1 } } },
      ]),

      // By priority
      this.jobModel.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),

      // By applied via
      this.jobModel.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$appliedVia', count: { $sum: 1 } } },
      ]),

      // Applications this week
      this.jobModel.countDocuments({
        ...baseQuery,
        appliedDate: { $gte: oneWeekAgo },
      }),

      // Applications this month
      this.jobModel.countDocuments({
        ...baseQuery,
        appliedDate: { $gte: oneMonthAgo },
      }),

      // Responses this week
      this.jobModel.countDocuments({
        ...baseQuery,
        responseStatus: ResponseStatus.RESPONSE_RECEIVED,
        responseDate: { $gte: oneWeekAgo },
      }),

      // Interviews scheduled
      this.jobModel.countDocuments({
        ...baseQuery,
        interviewScheduled: true,
        interviewDate: { $gte: new Date() },
      }),

      // Salary statistics
      this.jobModel.aggregate([
        { $match: { ...baseQuery, salaryMin: { $ne: null } } },
        {
          $group: {
            _id: null,
            avgSalaryMin: { $avg: '$salaryMin' },
            avgSalaryMax: { $avg: '$salaryMax' },
          },
        },
      ]),
    ]);

    // Transform aggregation results to match expected format
    const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
    const responseStatusMap = Object.fromEntries(
      byResponseStatus.map((s) => [s._id, s.count]),
    );

    // Calculate rates
    const responsesReceived =
      responseStatusMap[ResponseStatus.RESPONSE_RECEIVED] || 0;
    const interviews = statusMap[JobStatus.INTERVIEW_SCHEDULED] || 0;
    const offers = statusMap[JobStatus.OFFER_RECEIVED] || 0;

    return {
      totalJobs,
      byStatus: statusMap,
      byResponseStatus: responseStatusMap,
      byLocationType: Object.fromEntries(
        byLocationType.map((s) => [s._id, s.count]),
      ),
      byPriority: Object.fromEntries(byPriority.map((s) => [s._id, s.count])),
      byAppliedVia: Object.fromEntries(
        byAppliedVia.map((s) => [s._id, s.count]),
      ),
      responseRate: totalJobs > 0 ? (responsesReceived / totalJobs) * 100 : 0,
      interviewRate: totalJobs > 0 ? (interviews / totalJobs) * 100 : 0,
      offerRate: totalJobs > 0 ? (offers / totalJobs) * 100 : 0,
      applicationsThisWeek,
      applicationsThisMonth,
      responsesThisWeek,
      interviewsScheduled,
      averageSalaryMin: salaryStats[0]?.avgSalaryMin || null,
      averageSalaryMax: salaryStats[0]?.avgSalaryMax || null,
    };
  }

  // ================================
  // Helper Methods
  // ================================

  private mapStatusToTimelineEvent(status: JobStatus): JobTimelineEventType {
    const statusMap: Record<JobStatus, JobTimelineEventType> = {
      [JobStatus.APPLIED]: JobTimelineEventType.APPLIED,
      [JobStatus.INTERVIEW_SCHEDULED]: JobTimelineEventType.INTERVIEW,
      [JobStatus.INTERVIEW_COMPLETED]: JobTimelineEventType.INTERVIEW,
      [JobStatus.OFFER_RECEIVED]: JobTimelineEventType.OFFER,
      [JobStatus.ACCEPTED]: JobTimelineEventType.ACCEPTED,
      [JobStatus.REJECTED]: JobTimelineEventType.REJECTION,
      [JobStatus.WITHDRAWN]: JobTimelineEventType.WITHDRAWAL,
      [JobStatus.NO_RESPONSE]: JobTimelineEventType.OTHER,
    };

    return statusMap[status] || JobTimelineEventType.OTHER;
  }
}
