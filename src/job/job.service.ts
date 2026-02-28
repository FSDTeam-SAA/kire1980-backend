import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, JobStatus, JobTimelineEventType } from '@prisma/client';
import { PrismaService } from '../common/services/prisma.service';
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

@Injectable()
export class JobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly customLogger: CustomLoggerService,
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

    const job = await this.prisma.$transaction(async (tx) => {
      // Create the job
      const newJob = await tx.job.create({
        data: {
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
          aiParsedData: createJobDto.aiParsedData as
            | Prisma.InputJsonValue
            | undefined,
          aiConfidenceScore: createJobDto.aiConfidenceScore,
          sourceType: createJobDto.sourceType || 'MANUAL',
          rawJobPosting: createJobDto.rawJobPosting,
          nextFollowUpDate: createJobDto.nextFollowUpDate
            ? new Date(createJobDto.nextFollowUpDate)
            : null,
        },
      });

      // Create initial timeline event
      await tx.jobTimelineEvent.create({
        data: {
          jobId: newJob.id,
          eventType: 'APPLIED',
          title: 'Application Submitted',
          description: `Applied to ${createJobDto.company} for ${createJobDto.role} position via ${createJobDto.appliedVia}`,
          metadata: {
            appliedVia: createJobDto.appliedVia,
            location: createJobDto.location,
            locationType: createJobDto.locationType,
          },
        },
      });

      // Log activity
      await this.activityLogService.logCreate(
        'Job',
        newJob.id,
        {
          company: newJob.company,
          role: newJob.role,
          location: newJob.location,
          status: newJob.status,
          appliedVia: newJob.appliedVia,
        },
        { ...meta, actionedBy: authId },
        tx,
      );

      return newJob;
    });

    this.customLogger.log(
      `Job application created successfully: ${job.id}`,
      'JobService',
    );

    return job;
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

    // Build where clause
    const where: Prisma.JobWhereInput = {
      authId,
      deletedAt: null, // Exclude soft-deleted jobs
    };

    // Search across multiple fields
    if (search) {
      where.OR = [
        { company: { contains: search, mode: 'insensitive' } },
        { role: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { techStack: { hasSome: [search] } },
        { tags: { hasSome: [search] } },
      ];
    }

    // Status filters
    if (status && status.length > 0) {
      where.status = { in: status };
    }

    if (responseStatus && responseStatus.length > 0) {
      where.responseStatus = { in: responseStatus };
    }

    if (priority && priority.length > 0) {
      where.priority = { in: priority };
    }

    if (locationType && locationType.length > 0) {
      where.locationType = { in: locationType };
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (appliedVia && appliedVia.length > 0) {
      where.appliedVia = { in: appliedVia };
    }

    // Date filters
    if (appliedDateFrom || appliedDateTo) {
      where.appliedDate = {};
      if (appliedDateFrom) {
        where.appliedDate.gte = new Date(appliedDateFrom);
      }
      if (appliedDateTo) {
        where.appliedDate.lte = new Date(appliedDateTo);
      }
    }

    if (responseDateFrom || responseDateTo) {
      where.responseDate = {};
      if (responseDateFrom) {
        where.responseDate.gte = new Date(responseDateFrom);
      }
      if (responseDateTo) {
        where.responseDate.lte = new Date(responseDateTo);
      }
    }

    // Salary filters
    if (salaryMinFrom !== undefined) {
      where.salaryMin = { gte: salaryMinFrom };
    }

    if (salaryMaxTo !== undefined) {
      where.salaryMax = { lte: salaryMaxTo };
    }

    // Boolean filters
    if (isFavorite !== undefined) {
      where.isFavorite = isFavorite;
    }

    if (isArchived !== undefined) {
      where.isArchived = isArchived;
    }

    if (interviewScheduled !== undefined) {
      where.interviewScheduled = interviewScheduled;
    }

    // Array filters
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    if (techStack && techStack.length > 0) {
      where.techStack = { hasSome: techStack };
    }

    if (company) {
      where.company = { contains: company, mode: 'insensitive' };
    }

    // Build orderBy
    const orderBy: Prisma.JobOrderByWithRelationInput = {};
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
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.appliedDate = 'desc';
    }

    // Execute queries
    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.job.count({ where }),
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
  async findJobById(authId: string, jobId: string, includeRelations = false) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: includeRelations
        ? {
            followUps: {
              orderBy: { scheduledDate: 'desc' },
            },
            jobNotes: {
              orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
            },
            timeline: {
              orderBy: { createdAt: 'desc' },
            },
            documents: {
              orderBy: { createdAt: 'desc' },
            },
          }
        : undefined,
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.authId !== authId) {
      throw new ForbiddenException('You do not have access to this job');
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

    const updatedJob = await this.prisma.$transaction(async (tx) => {
      // Prepare update data
      const updateData: Prisma.JobUpdateInput = {};

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
        updateData.aiParsedData =
          updateJobDto.aiParsedData as Prisma.InputJsonValue;
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

        // Create timeline event for status change
        const timelineEventType = this.mapStatusToTimelineEvent(
          updateJobDto.status,
        );
        await tx.jobTimelineEvent.create({
          data: {
            jobId,
            eventType: timelineEventType,
            title: `Status changed to ${updateJobDto.status}`,
            description: `Job status changed from ${existingJob.status} to ${updateJobDto.status}`,
            metadata: {
              previousStatus: existingJob.status,
              newStatus: updateJobDto.status,
            },
          },
        });
      }

      // Handle response status change with timeline event
      if (
        updateJobDto.responseStatus !== undefined &&
        updateJobDto.responseStatus !== existingJob.responseStatus
      ) {
        updateData.responseStatus = updateJobDto.responseStatus;

        if (updateJobDto.responseStatus === 'RESPONSE_RECEIVED') {
          await tx.jobTimelineEvent.create({
            data: {
              jobId,
              eventType: 'RESPONSE_RECEIVED',
              title: 'Response Received',
              description: `Received a response from ${existingJob.company}`,
            },
          });
        }
      }

      // Handle interview scheduled
      if (
        updateJobDto.interviewScheduled &&
        !existingJob.interviewScheduled &&
        updateJobDto.interviewDate
      ) {
        await tx.jobTimelineEvent.create({
          data: {
            jobId,
            eventType: 'INTERVIEW_SCHEDULED',
            title: 'Interview Scheduled',
            description: `Interview scheduled for ${new Date(updateJobDto.interviewDate).toLocaleDateString()}`,
            metadata: {
              interviewDate: updateJobDto.interviewDate,
              interviewType: updateJobDto.interviewType,
              interviewRound: updateJobDto.interviewRound,
            },
          },
        });
      }

      // Update the job
      const job = await tx.job.update({
        where: { id: jobId },
        data: updateData,
      });

      // Log activity
      await this.activityLogService.logUpdate(
        'Job',
        jobId,
        existingJob,
        job,
        { ...meta, actionedBy: authId },
        tx,
      );

      return job;
    });

    this.customLogger.log(`Job updated successfully: ${jobId}`, 'JobService');

    return updatedJob;
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

    await this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: { deletedAt: new Date() },
      });

      await this.activityLogService.logDelete(
        'Job',
        jobId,
        { company: existingJob.company, role: existingJob.role },
        { ...meta, actionedBy: authId },
        tx,
      );
    });

    return { message: 'Job deleted successfully' };
  }

  /**
   * Permanently delete a job (admin only or cleanup)
   */
  async hardDeleteJob(authId: string, jobId: string) {
    const existingJob = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!existingJob || existingJob.authId !== authId) {
      throw new NotFoundException('Job not found');
    }

    await this.prisma.job.delete({
      where: { id: jobId },
    });

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

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: { isArchived: !existingJob.isArchived },
    });

    return updatedJob;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavoriteJob(authId: string, jobId: string) {
    const existingJob = await this.findJobById(authId, jobId);

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: { isFavorite: !existingJob.isFavorite },
    });

    return updatedJob;
  }

  /**
   * Bulk archive jobs
   */
  async bulkArchiveJobs(authId: string, jobIds: string[]) {
    // Verify all jobs belong to user
    const jobs = await this.prisma.job.findMany({
      where: {
        id: { in: jobIds },
        authId,
        deletedAt: null,
      },
    });

    if (jobs.length !== jobIds.length) {
      throw new ForbiddenException(
        'Some jobs were not found or you do not have access',
      );
    }

    await this.prisma.job.updateMany({
      where: { id: { in: jobIds } },
      data: { isArchived: true },
    });

    return { message: `${jobIds.length} jobs archived successfully` };
  }

  /**
   * Bulk delete jobs (soft delete)
   */
  async bulkDeleteJobs(authId: string, jobIds: string[]) {
    const jobs = await this.prisma.job.findMany({
      where: {
        id: { in: jobIds },
        authId,
        deletedAt: null,
      },
    });

    if (jobs.length !== jobIds.length) {
      throw new ForbiddenException(
        'Some jobs were not found or you do not have access',
      );
    }

    await this.prisma.job.updateMany({
      where: { id: { in: jobIds } },
      data: { deletedAt: new Date() },
    });

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

    const followUp = await this.prisma.$transaction(async (tx) => {
      const newFollowUp = await tx.jobFollowUp.create({
        data: {
          jobId,
          scheduledDate: new Date(createFollowUpDto.scheduledDate),
          type: createFollowUpDto.type,
          subject: createFollowUpDto.subject,
          message: createFollowUpDto.message,
        },
      });

      // Update job's next follow-up date
      const pendingFollowUps = await tx.jobFollowUp.findMany({
        where: { jobId, status: 'PENDING' },
        orderBy: { scheduledDate: 'asc' },
        take: 1,
      });

      if (pendingFollowUps.length > 0) {
        await tx.job.update({
          where: { id: jobId },
          data: { nextFollowUpDate: pendingFollowUps[0].scheduledDate },
        });
      }

      // Create timeline event
      await tx.jobTimelineEvent.create({
        data: {
          jobId,
          eventType: 'FOLLOW_UP_SENT',
          title: 'Follow-up Scheduled',
          description: `${createFollowUpDto.type} follow-up scheduled for ${new Date(createFollowUpDto.scheduledDate).toLocaleDateString()}`,
          metadata: {
            followUpId: newFollowUp.id,
            type: createFollowUpDto.type,
          },
        },
      });

      return newFollowUp;
    });

    return followUp;
  }

  /**
   * Get all follow-ups for a job
   */
  async getFollowUps(authId: string, jobId: string) {
    await this.findJobById(authId, jobId);

    return this.prisma.jobFollowUp.findMany({
      where: { jobId },
      orderBy: { scheduledDate: 'desc' },
    });
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
    await this.findJobById(authId, jobId);

    const followUp = await this.prisma.jobFollowUp.findUnique({
      where: { id: followUpId },
    });

    if (!followUp || followUp.jobId !== jobId) {
      throw new NotFoundException('Follow-up not found');
    }

    return this.prisma.jobFollowUp.update({
      where: { id: followUpId },
      data: {
        scheduledDate: updateFollowUpDto.scheduledDate
          ? new Date(updateFollowUpDto.scheduledDate)
          : undefined,
        completedDate: updateFollowUpDto.completedDate
          ? new Date(updateFollowUpDto.completedDate)
          : undefined,
        status: updateFollowUpDto.status,
        type: updateFollowUpDto.type,
        subject: updateFollowUpDto.subject,
        message: updateFollowUpDto.message,
        response: updateFollowUpDto.response,
      },
    });
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
    await this.findJobById(authId, jobId);

    const followUp = await this.prisma.jobFollowUp.findUnique({
      where: { id: followUpId },
    });

    if (!followUp || followUp.jobId !== jobId) {
      throw new NotFoundException('Follow-up not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const completedFollowUp = await tx.jobFollowUp.update({
        where: { id: followUpId },
        data: {
          status: completeDto.status || 'COMPLETED',
          completedDate: new Date(),
          response: completeDto.response,
        },
      });

      // Update job's follow-up tracking
      const job = await tx.job.findUnique({ where: { id: jobId } });

      // Get next pending follow-up
      const nextFollowUp = await tx.jobFollowUp.findFirst({
        where: { jobId, status: 'PENDING' },
        orderBy: { scheduledDate: 'asc' },
      });

      await tx.job.update({
        where: { id: jobId },
        data: {
          followUpCount: (job?.followUpCount || 0) + 1,
          lastFollowUpDate: new Date(),
          nextFollowUpDate: nextFollowUp?.scheduledDate || null,
        },
      });

      return completedFollowUp;
    });
  }

  /**
   * Delete a follow-up
   */
  async deleteFollowUp(authId: string, jobId: string, followUpId: string) {
    await this.findJobById(authId, jobId);

    const followUp = await this.prisma.jobFollowUp.findUnique({
      where: { id: followUpId },
    });

    if (!followUp || followUp.jobId !== jobId) {
      throw new NotFoundException('Follow-up not found');
    }

    await this.prisma.jobFollowUp.delete({
      where: { id: followUpId },
    });

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

    const note = await this.prisma.$transaction(async (tx) => {
      const newNote = await tx.jobNote.create({
        data: {
          jobId,
          title: createNoteDto.title,
          content: createNoteDto.content,
          isPinned: createNoteDto.isPinned || false,
          category: createNoteDto.category,
        },
      });

      // Create timeline event
      await tx.jobTimelineEvent.create({
        data: {
          jobId,
          eventType: 'NOTE_ADDED',
          title: 'Note Added',
          description: createNoteDto.title,
          metadata: {
            noteId: newNote.id,
            category: createNoteDto.category,
          },
        },
      });

      return newNote;
    });

    return note;
  }

  /**
   * Get all notes for a job
   */
  async getNotes(authId: string, jobId: string) {
    await this.findJobById(authId, jobId);

    return this.prisma.jobNote.findMany({
      where: { jobId },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
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
    await this.findJobById(authId, jobId);

    const note = await this.prisma.jobNote.findUnique({
      where: { id: noteId },
    });

    if (!note || note.jobId !== jobId) {
      throw new NotFoundException('Note not found');
    }

    return this.prisma.jobNote.update({
      where: { id: noteId },
      data: {
        title: updateNoteDto.title,
        content: updateNoteDto.content,
        isPinned: updateNoteDto.isPinned,
        category: updateNoteDto.category,
      },
    });
  }

  /**
   * Toggle pin status of a note
   */
  async togglePinNote(authId: string, jobId: string, noteId: string) {
    await this.findJobById(authId, jobId);

    const note = await this.prisma.jobNote.findUnique({
      where: { id: noteId },
    });

    if (!note || note.jobId !== jobId) {
      throw new NotFoundException('Note not found');
    }

    return this.prisma.jobNote.update({
      where: { id: noteId },
      data: { isPinned: !note.isPinned },
    });
  }

  /**
   * Delete a note
   */
  async deleteNote(authId: string, jobId: string, noteId: string) {
    await this.findJobById(authId, jobId);

    const note = await this.prisma.jobNote.findUnique({
      where: { id: noteId },
    });

    if (!note || note.jobId !== jobId) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.jobNote.delete({
      where: { id: noteId },
    });

    return { message: 'Note deleted successfully' };
  }

  // ================================
  // Timeline Operations
  // ================================

  /**
   * Get timeline for a job
   */
  async getTimeline(authId: string, jobId: string) {
    await this.findJobById(authId, jobId);

    return this.prisma.jobTimelineEvent.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
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

    return this.prisma.jobTimelineEvent.create({
      data: {
        jobId,
        eventType: 'CUSTOM',
        title,
        description,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  // ================================
  // Statistics Operations
  // ================================

  /**
   * Get job statistics for a user
   */
  async getStatistics(authId: string) {
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
      this.prisma.job.count({
        where: { authId, deletedAt: null },
      }),

      // By status
      this.prisma.job.groupBy({
        by: ['status'],
        where: { authId, deletedAt: null },
        _count: true,
      }),

      // By response status
      this.prisma.job.groupBy({
        by: ['responseStatus'],
        where: { authId, deletedAt: null },
        _count: true,
      }),

      // By location type
      this.prisma.job.groupBy({
        by: ['locationType'],
        where: { authId, deletedAt: null },
        _count: true,
      }),

      // By priority
      this.prisma.job.groupBy({
        by: ['priority'],
        where: { authId, deletedAt: null },
        _count: true,
      }),

      // By applied via
      this.prisma.job.groupBy({
        by: ['appliedVia'],
        where: { authId, deletedAt: null },
        _count: true,
      }),

      // Applications this week
      this.prisma.job.count({
        where: {
          authId,
          deletedAt: null,
          appliedDate: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Applications this month
      this.prisma.job.count({
        where: {
          authId,
          deletedAt: null,
          appliedDate: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Responses this week
      this.prisma.job.count({
        where: {
          authId,
          deletedAt: null,
          responseStatus: 'RESPONSE_RECEIVED',
          responseDate: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Interviews scheduled
      this.prisma.job.count({
        where: {
          authId,
          deletedAt: null,
          interviewScheduled: true,
          interviewDate: {
            gte: new Date(),
          },
        },
      }),

      // Salary statistics
      this.prisma.job.aggregate({
        where: {
          authId,
          deletedAt: null,
          salaryMin: { not: null },
        },
        _avg: {
          salaryMin: true,
          salaryMax: true,
        },
      }),
    ]);

    // Calculate rates
    const responsesReceived =
      byResponseStatus.find((s) => s.responseStatus === 'RESPONSE_RECEIVED')
        ?._count || 0;
    const interviews =
      byStatus.find((s) => s.status === 'INTERVIEW')?._count || 0;
    const offers = byStatus.find((s) => s.status === 'OFFER')?._count || 0;

    return {
      totalJobs,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byResponseStatus: Object.fromEntries(
        byResponseStatus.map((s) => [s.responseStatus, s._count]),
      ),
      byLocationType: Object.fromEntries(
        byLocationType.map((s) => [s.locationType, s._count]),
      ),
      byPriority: Object.fromEntries(
        byPriority.map((s) => [s.priority, s._count]),
      ),
      byAppliedVia: Object.fromEntries(
        byAppliedVia.map((s) => [s.appliedVia, s._count]),
      ),
      responseRate: totalJobs > 0 ? (responsesReceived / totalJobs) * 100 : 0,
      interviewRate: totalJobs > 0 ? (interviews / totalJobs) * 100 : 0,
      offerRate: totalJobs > 0 ? (offers / totalJobs) * 100 : 0,
      applicationsThisWeek,
      applicationsThisMonth,
      responsesThisWeek,
      interviewsScheduled,
      averageSalaryMin: salaryStats._avg.salaryMin,
      averageSalaryMax: salaryStats._avg.salaryMax,
    };
  }

  // ================================
  // Helper Methods
  // ================================

  private mapStatusToTimelineEvent(status: JobStatus): JobTimelineEventType {
    const statusMap: Record<JobStatus, JobTimelineEventType> = {
      APPLIED: 'APPLIED',
      SCREENING: 'STATUS_CHANGED',
      INTERVIEW: 'INTERVIEW_SCHEDULED',
      OFFER: 'OFFER_RECEIVED',
      REJECTED: 'REJECTED',
      ACCEPTED: 'OFFER_ACCEPTED',
      DECLINED: 'OFFER_DECLINED',
      WITHDRAWN: 'WITHDRAWN',
    };

    return statusMap[status] || 'STATUS_CHANGED';
  }
}
