"use strict";
/**
 * Helper functions for converting between domain entities and Zod-validated types in tests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZodTestHelpers = void 0;
class ZodTestHelpers {
    /**
     * Ensure a valid Discord snowflake ID
     */
    static ensureSnowflake(id) {
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
    static objectIdToString(id) {
        if (!id)
            return undefined;
        return typeof id === 'string' ? id : id.toString();
    }
    /**
     * Convert application with proper status type
     */
    static toZodApplication(app) {
        return {
            ...app,
            _id: this.objectIdToString(app._id),
            guildId: this.ensureSnowflake(app.guildId),
            applicantId: this.ensureSnowflake(app.applicantId),
            status: app.status,
            jobId: this.objectIdToString(app.jobId) || app.jobId,
            reviewedBy: app.reviewedBy ? this.ensureSnowflake(app.reviewedBy) : undefined
        };
    }
    /**
     * Convert staff with proper role type
     */
    static toZodStaff(staff) {
        return {
            ...staff,
            _id: this.objectIdToString(staff._id),
            guildId: this.ensureSnowflake(staff.guildId),
            userId: this.ensureSnowflake(staff.userId),
            hiredBy: this.ensureSnowflake(staff.hiredBy),
            role: staff.role,
            terminatedBy: staff.terminatedBy ? this.ensureSnowflake(staff.terminatedBy) : undefined
        };
    }
    /**
     * Convert job with proper type
     */
    static toZodJob(job) {
        return {
            ...job,
            _id: this.objectIdToString(job._id),
            guildId: this.ensureSnowflake(job.guildId),
            roleId: this.ensureSnowflake(job.roleId),
            postedBy: this.ensureSnowflake(job.postedBy),
            closedBy: job.closedBy ? this.ensureSnowflake(job.closedBy) : undefined,
            staffRole: job.staffRole // staffRole is string in Zod schema
        };
    }
    /**
     * Convert case with proper type
     */
    static toZodCase(caseEntity) {
        return {
            ...caseEntity,
            _id: this.objectIdToString(caseEntity._id),
            guildId: this.ensureSnowflake(caseEntity.guildId),
            clientId: this.ensureSnowflake(caseEntity.clientId),
            status: caseEntity.status,
            priority: caseEntity.priority,
            leadAttorneyId: caseEntity.leadAttorneyId ? this.ensureSnowflake(caseEntity.leadAttorneyId) : undefined,
            assignedLawyerIds: (caseEntity.assignedLawyerIds || []).map((id) => this.ensureSnowflake(id)),
            channelId: caseEntity.channelId ? this.ensureSnowflake(caseEntity.channelId) : undefined,
            closedBy: caseEntity.closedBy ? this.ensureSnowflake(caseEntity.closedBy) : undefined
        };
    }
    /**
     * Convert feedback with proper rating
     */
    static toZodFeedback(feedback) {
        return {
            ...feedback,
            _id: this.objectIdToString(feedback._id),
            guildId: this.ensureSnowflake(feedback.guildId),
            submitterId: this.ensureSnowflake(feedback.submitterId),
            targetStaffId: feedback.targetStaffId ? this.ensureSnowflake(feedback.targetStaffId) : undefined,
            rating: feedback.rating
        };
    }
    /**
     * Convert retainer with proper status
     */
    static toZodRetainer(retainer) {
        return {
            ...retainer,
            _id: this.objectIdToString(retainer._id),
            guildId: this.ensureSnowflake(retainer.guildId),
            clientId: this.ensureSnowflake(retainer.clientId),
            lawyerId: this.ensureSnowflake(retainer.lawyerId),
            status: retainer.status
        };
    }
    /**
     * Convert reminder
     */
    static toZodReminder(reminder) {
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
exports.ZodTestHelpers = ZodTestHelpers;
//# sourceMappingURL=zod-test-helpers.js.map