"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
class ApplicationRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('applications');
    }
    async findByApplicantAndJob(applicantId, jobId) {
        return this.findOne({ applicantId, jobId });
    }
    async findByApplicant(applicantId) {
        return this.findByFilters({ applicantId });
    }
    async findByJob(jobId) {
        return this.findByFilters({ jobId });
    }
    async findByStatus(status) {
        return this.findByFilters({ status });
    }
    async findByGuild(guildId) {
        return this.findByFilters({ guildId });
    }
    async findPendingApplications(guildId) {
        return this.findByFilters({ guildId, status: 'pending' });
    }
    async findApplicationsByJobAndStatus(jobId, status) {
        return this.findByFilters({ jobId, status });
    }
    async hasExistingApplication(applicantId, jobId) {
        const existing = await this.findByApplicantAndJob(applicantId, jobId);
        return existing !== null;
    }
}
exports.ApplicationRepository = ApplicationRepository;
//# sourceMappingURL=application-repository.js.map