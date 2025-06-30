"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const validation_1 = require("../../validation");
class ApplicationRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('applications');
    }
    async findByApplicantAndJob(applicantId, jobId) {
        const validatedApplicantId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, applicantId, 'Applicant ID');
        const validatedJobId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), jobId, 'Job ID');
        return this.findOne({ applicantId: validatedApplicantId, jobId: validatedJobId });
    }
    async findByApplicant(applicantId) {
        const validatedApplicantId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, applicantId, 'Applicant ID');
        return this.findByFilters({ applicantId: validatedApplicantId });
    }
    async findByJob(jobId) {
        const validatedJobId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), jobId, 'Job ID');
        return this.findByFilters({ jobId: validatedJobId });
    }
    async findByStatus(status) {
        const validatedStatus = validation_1.ValidationHelpers.validateOrThrow(validation_1.ApplicationStatusSchema, status, 'Application status');
        return this.findByFilters({ status: validatedStatus });
    }
    async findByGuild(guildId) {
        const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
        return this.findByFilters({ guildId: validatedGuildId });
    }
    async findPendingApplications(guildId) {
        const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
        return this.findByFilters({ guildId: validatedGuildId, status: 'pending' });
    }
    async findApplicationsByJobAndStatus(jobId, status) {
        const validatedJobId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), jobId, 'Job ID');
        const validatedStatus = validation_1.ValidationHelpers.validateOrThrow(validation_1.ApplicationStatusSchema, status, 'Application status');
        return this.findByFilters({ jobId: validatedJobId, status: validatedStatus });
    }
    async hasExistingApplication(applicantId, jobId) {
        const existing = await this.findByApplicantAndJob(applicantId, jobId);
        return existing !== null;
    }
}
exports.ApplicationRepository = ApplicationRepository;
//# sourceMappingURL=application-repository.js.map