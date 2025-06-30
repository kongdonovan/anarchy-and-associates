/**
 * Helper functions for converting between domain entities and Zod-validated types in tests
 */

import { ObjectId } from 'mongodb';
import { 
  Staff,
  Case,
  Job,
  Application,
  Retainer,
  Reminder,
  Feedback,
  StaffRole,
  CaseStatus,
  CasePriority,
  RetainerStatus,
  FeedbackRating,
  ApplicationStatus
} from '../../validation';

export class ZodTestHelpers {
  /**
   * Ensure a valid Discord snowflake ID
   */
  static ensureSnowflake(id: string | undefined): string {
    if (!id || id.length < 17 || id.length > 21 || !/^\d+$/.test(id)) {
      // Generate a valid Discord snowflake
      const timestamp = Date.now() - 1420070400000; // Discord epoch
      const workerId = Math.floor(Math.random() * 31);
      const processId = Math.floor(Math.random() * 31);
      const increment = Math.floor(Math.random() * 4095);
      
      const snowflake = (BigInt(timestamp) << 22n) | (BigInt(workerId) << 17n) | (BigInt(processId) << 12n) | BigInt(increment);
      return snowflake.toString();
    }
    return id;
  }

  /**
   * Convert ObjectId to string
   */
  static objectIdToString(id: ObjectId | string | undefined): string | undefined {
    if (!id) return undefined;
    return typeof id === 'string' ? id : id.toString();
  }

  /**
   * Convert application with proper status type
   */
  static toZodApplication(app: any): Application {
    return {
      ...app,
      _id: this.objectIdToString(app._id),
      guildId: this.ensureSnowflake(app.guildId),
      applicantId: this.ensureSnowflake(app.applicantId),
      status: app.status as ApplicationStatus,
      jobId: this.objectIdToString(app.jobId) || app.jobId,
      reviewedBy: app.reviewedBy ? this.ensureSnowflake(app.reviewedBy) : undefined
    };
  }

  /**
   * Convert staff with proper role type
   */
  static toZodStaff(staff: any): Staff {
    return {
      ...staff,
      _id: this.objectIdToString(staff._id),
      guildId: this.ensureSnowflake(staff.guildId),
      userId: this.ensureSnowflake(staff.userId),
      hiredBy: this.ensureSnowflake(staff.hiredBy),
      role: staff.role as StaffRole,
      terminatedBy: staff.terminatedBy ? this.ensureSnowflake(staff.terminatedBy) : undefined
    };
  }

  /**
   * Convert job with proper type
   */
  static toZodJob(job: any): Job {
    return {
      ...job,
      _id: this.objectIdToString(job._id),
      guildId: this.ensureSnowflake(job.guildId),
      roleId: this.ensureSnowflake(job.roleId),
      postedBy: this.ensureSnowflake(job.postedBy),
      closedBy: job.closedBy ? this.ensureSnowflake(job.closedBy) : undefined,
      staffRole: job.staffRole as string // staffRole is string in Zod schema
    };
  }

  /**
   * Convert case with proper type
   */
  static toZodCase(caseEntity: any): Case {
    return {
      ...caseEntity,
      _id: this.objectIdToString(caseEntity._id),
      guildId: this.ensureSnowflake(caseEntity.guildId),
      clientId: this.ensureSnowflake(caseEntity.clientId),
      status: caseEntity.status as CaseStatus,
      priority: caseEntity.priority as CasePriority,
      leadAttorneyId: caseEntity.leadAttorneyId ? this.ensureSnowflake(caseEntity.leadAttorneyId) : undefined,
      assignedLawyerIds: (caseEntity.assignedLawyerIds || []).map((id: string) => this.ensureSnowflake(id)),
      channelId: caseEntity.channelId ? this.ensureSnowflake(caseEntity.channelId) : undefined,
      closedBy: caseEntity.closedBy ? this.ensureSnowflake(caseEntity.closedBy) : undefined
    };
  }

  /**
   * Convert feedback with proper rating
   */
  static toZodFeedback(feedback: any): Feedback {
    return {
      ...feedback,
      _id: this.objectIdToString(feedback._id),
      guildId: this.ensureSnowflake(feedback.guildId),
      submitterId: this.ensureSnowflake(feedback.submitterId),
      targetStaffId: feedback.targetStaffId ? this.ensureSnowflake(feedback.targetStaffId) : undefined,
      rating: feedback.rating as FeedbackRating
    };
  }

  /**
   * Convert retainer with proper status
   */
  static toZodRetainer(retainer: any): Retainer {
    return {
      ...retainer,
      _id: this.objectIdToString(retainer._id),
      guildId: this.ensureSnowflake(retainer.guildId),
      clientId: this.ensureSnowflake(retainer.clientId),
      lawyerId: this.ensureSnowflake(retainer.lawyerId),
      status: retainer.status as RetainerStatus
    };
  }

  /**
   * Convert reminder
   */
  static toZodReminder(reminder: any): Reminder {
    return {
      ...reminder,
      _id: this.objectIdToString(reminder._id),
      guildId: this.ensureSnowflake(reminder.guildId),
      userId: this.ensureSnowflake(reminder.userId),
      channelId: this.ensureSnowflake(reminder.channelId),
      caseId: reminder.caseId ? this.objectIdToString(reminder.caseId) : undefined
    };
  }
}