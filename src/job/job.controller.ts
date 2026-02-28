import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JobService } from './job.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CustomLoggerService } from '../common/services/custom-logger.service';
import { THROTTLER_CONFIG } from '../common/config/throttler.config';
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

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: string;
    tokenVersion: number;
  };
}

@Controller('jobs')
@UseGuards(AuthGuard)
export class JobController {
  constructor(
    private readonly jobService: JobService,
    private readonly customLogger: CustomLoggerService,
  ) {}

  // ================================
  // Job CRUD Endpoints
  // ================================

  /**
   * Create a new job application
   * POST /jobs
   */
  @Post()
  @Throttle({ default: THROTTLER_CONFIG.DEFAULT })
  async createJob(
    @Body() createJobDto: CreateJobDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.customLogger.log(
      `Creating job for user: ${req.user.userId}`,
      'JobController',
    );

    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    return this.jobService.createJob(req.user.userId, createJobDto, meta);
  }

  /**
   * Get all jobs with filtering, pagination, and sorting
   * GET /jobs
   */
  @Get()
  async findAllJobs(
    @Query() filterDto: JobFilterDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.customLogger.log(
      `Fetching jobs for user: ${req.user.userId}`,
      'JobController',
    );

    return this.jobService.findAllJobs(req.user.userId, filterDto);
  }

  /**
   * Get job statistics
   * GET /jobs/statistics
   */
  @Get('statistics')
  async getStatistics(@Req() req: AuthenticatedRequest) {
    this.customLogger.log(
      `Fetching job statistics for user: ${req.user.userId}`,
      'JobController',
    );

    return this.jobService.getStatistics(req.user.userId);
  }

  /**
   * Get a single job by ID
   * GET /jobs/:id
   */
  @Get(':id')
  async findJobById(
    @Param('id') id: string,
    @Query('include') include: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.customLogger.log(
      `Fetching job ${id} for user: ${req.user.userId}`,
      'JobController',
    );

    const includeRelations = include === 'all' || include === 'true';
    return this.jobService.findJobById(req.user.userId, id, includeRelations);
  }

  /**
   * Update a job
   * PUT /jobs/:id
   */
  @Put(':id')
  async updateJob(
    @Param('id') id: string,
    @Body() updateJobDto: UpdateJobDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.customLogger.log(
      `Updating job ${id} for user: ${req.user.userId}`,
      'JobController',
    );

    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    return this.jobService.updateJob(req.user.userId, id, updateJobDto, meta);
  }

  /**
   * Partial update a job
   * PATCH /jobs/:id
   */
  @Patch(':id')
  async patchJob(
    @Param('id') id: string,
    @Body() updateJobDto: UpdateJobDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.customLogger.log(
      `Patching job ${id} for user: ${req.user.userId}`,
      'JobController',
    );

    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    return this.jobService.updateJob(req.user.userId, id, updateJobDto, meta);
  }

  /**
   * Delete a job (soft delete)
   * DELETE /jobs/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteJob(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    this.customLogger.log(
      `Deleting job ${id} for user: ${req.user.userId}`,
      'JobController',
    );

    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    return this.jobService.deleteJob(req.user.userId, id, meta);
  }

  /**
   * Toggle archive status
   * PATCH /jobs/:id/archive
   */
  @Patch(':id/archive')
  async toggleArchive(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.customLogger.log(`Toggling archive for job ${id}`, 'JobController');

    const meta = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    return this.jobService.toggleArchiveJob(req.user.userId, id, meta);
  }

  /**
   * Toggle favorite status
   * PATCH /jobs/:id/favorite
   */
  @Patch(':id/favorite')
  async toggleFavorite(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.customLogger.log(`Toggling favorite for job ${id}`, 'JobController');

    return this.jobService.toggleFavoriteJob(req.user.userId, id);
  }

  /**
   * Bulk archive jobs
   * POST /jobs/bulk/archive
   */
  @Post('bulk/archive')
  async bulkArchive(
    @Body('jobIds') jobIds: string[],
    @Req() req: AuthenticatedRequest,
  ) {
    this.customLogger.log(
      `Bulk archiving ${jobIds.length} jobs for user: ${req.user.userId}`,
      'JobController',
    );

    return this.jobService.bulkArchiveJobs(req.user.userId, jobIds);
  }

  /**
   * Bulk delete jobs
   * POST /jobs/bulk/delete
   */
  @Post('bulk/delete')
  async bulkDelete(
    @Body('jobIds') jobIds: string[],
    @Req() req: AuthenticatedRequest,
  ) {
    this.customLogger.log(
      `Bulk deleting ${jobIds.length} jobs for user: ${req.user.userId}`,
      'JobController',
    );

    return this.jobService.bulkDeleteJobs(req.user.userId, jobIds);
  }

  // ================================
  // Follow-Up Endpoints
  // ================================

  /**
   * Create a follow-up for a job
   * POST /jobs/:jobId/follow-ups
   */
  @Post(':jobId/follow-ups')
  async createFollowUp(
    @Param('jobId') jobId: string,
    @Body() createFollowUpDto: CreateJobFollowUpDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.customLogger.log(
      `Creating follow-up for job ${jobId}`,
      'JobController',
    );

    return this.jobService.createFollowUp(
      req.user.userId,
      jobId,
      createFollowUpDto,
    );
  }

  /**
   * Get all follow-ups for a job
   * GET /jobs/:jobId/follow-ups
   */
  @Get(':jobId/follow-ups')
  async getFollowUps(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.jobService.getFollowUps(req.user.userId, jobId);
  }

  /**
   * Update a follow-up
   * PUT /jobs/:jobId/follow-ups/:followUpId
   */
  @Put(':jobId/follow-ups/:followUpId')
  async updateFollowUp(
    @Param('jobId') jobId: string,
    @Param('followUpId') followUpId: string,
    @Body() updateFollowUpDto: UpdateJobFollowUpDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.jobService.updateFollowUp(
      req.user.userId,
      jobId,
      followUpId,
      updateFollowUpDto,
    );
  }

  /**
   * Complete a follow-up
   * PATCH /jobs/:jobId/follow-ups/:followUpId/complete
   */
  @Patch(':jobId/follow-ups/:followUpId/complete')
  async completeFollowUp(
    @Param('jobId') jobId: string,
    @Param('followUpId') followUpId: string,
    @Body() completeDto: CompleteJobFollowUpDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.jobService.completeFollowUp(
      req.user.userId,
      jobId,
      followUpId,
      completeDto,
    );
  }

  /**
   * Delete a follow-up
   * DELETE /jobs/:jobId/follow-ups/:followUpId
   */
  @Delete(':jobId/follow-ups/:followUpId')
  @HttpCode(HttpStatus.OK)
  async deleteFollowUp(
    @Param('jobId') jobId: string,
    @Param('followUpId') followUpId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.jobService.deleteFollowUp(req.user.userId, jobId, followUpId);
  }

  // ================================
  // Note Endpoints
  // ================================

  /**
   * Create a note for a job
   * POST /jobs/:jobId/notes
   */
  @Post(':jobId/notes')
  async createNote(
    @Param('jobId') jobId: string,
    @Body() createNoteDto: CreateJobNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.customLogger.log(`Creating note for job ${jobId}`, 'JobController');

    return this.jobService.createNote(req.user.userId, jobId, createNoteDto);
  }

  /**
   * Get all notes for a job
   * GET /jobs/:jobId/notes
   */
  @Get(':jobId/notes')
  async getNotes(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.jobService.getNotes(req.user.userId, jobId);
  }

  /**
   * Update a note
   * PUT /jobs/:jobId/notes/:noteId
   */
  @Put(':jobId/notes/:noteId')
  async updateNote(
    @Param('jobId') jobId: string,
    @Param('noteId') noteId: string,
    @Body() updateNoteDto: UpdateJobNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.jobService.updateNote(
      req.user.userId,
      jobId,
      noteId,
      updateNoteDto,
    );
  }

  /**
   * Toggle pin status of a note
   * PATCH /jobs/:jobId/notes/:noteId/pin
   */
  @Patch(':jobId/notes/:noteId/pin')
  async togglePinNote(
    @Param('jobId') jobId: string,
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.jobService.togglePinNote(req.user.userId, jobId, noteId);
  }

  /**
   * Delete a note
   * DELETE /jobs/:jobId/notes/:noteId
   */
  @Delete(':jobId/notes/:noteId')
  @HttpCode(HttpStatus.OK)
  async deleteNote(
    @Param('jobId') jobId: string,
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.jobService.deleteNote(req.user.userId, jobId, noteId);
  }

  // ================================
  // Timeline Endpoints
  // ================================

  /**
   * Get timeline for a job
   * GET /jobs/:jobId/timeline
   */
  @Get(':jobId/timeline')
  async getTimeline(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.jobService.getTimeline(req.user.userId, jobId);
  }

  /**
   * Add custom timeline event
   * POST /jobs/:jobId/timeline
   */
  @Post(':jobId/timeline')
  async addTimelineEvent(
    @Param('jobId') jobId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      metadata?: Record<string, unknown>;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.jobService.addTimelineEvent(
      req.user.userId,
      jobId,
      body.title,
      body.description,
      body.metadata,
    );
  }
}
