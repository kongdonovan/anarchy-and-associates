"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseRepository = void 0;
const case_1 = require("../../domain/entities/case");
const base_mongo_repository_1 = require("./base-mongo-repository");
class CaseRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('cases');
    }
    async findByCaseNumber(caseNumber) {
        return this.findOne({ caseNumber });
    }
    async findByClient(clientId) {
        return this.findByFilters({ clientId });
    }
    async findByStatus(status) {
        return this.findByFilters({ status });
    }
    async findByGuildAndStatus(guildId, status) {
        return this.findByFilters({ guildId, status });
    }
    async findByLawyer(lawyerId) {
        const leadCases = await this.findByFilters({ leadAttorneyId: lawyerId });
        const assignedCases = await this.findByFilters({ assignedLawyerIds: { $in: [lawyerId] } });
        // Combine and deduplicate
        const allCases = [...leadCases, ...assignedCases];
        const uniqueCases = allCases.filter((case1, index, self) => index === self.findIndex(case2 => case1._id?.toString() === case2._id?.toString()));
        return uniqueCases;
    }
    async findByLeadAttorney(leadAttorneyId) {
        return this.findByFilters({ leadAttorneyId });
    }
    async findAssignedToLawyer(lawyerId) {
        return this.findByFilters({ assignedLawyerIds: { $in: [lawyerId] } });
    }
    async searchCases(filters, sort, pagination) {
        try {
            // Build MongoDB query from filters
            const query = {};
            if (filters.guildId)
                query.guildId = filters.guildId;
            if (filters.status)
                query.status = filters.status;
            if (filters.priority)
                query.priority = filters.priority;
            if (filters.result)
                query.result = filters.result;
            if (filters.clientId)
                query.clientId = filters.clientId;
            if (filters.leadAttorneyId)
                query.leadAttorneyId = filters.leadAttorneyId;
            if (filters.assignedLawyerId)
                query.assignedLawyerIds = { $in: [filters.assignedLawyerId] };
            if (filters.caseNumber)
                query.caseNumber = { $regex: filters.caseNumber, $options: 'i' };
            if (filters.title)
                query.title = { $regex: filters.title, $options: 'i' };
            // Date range filters
            if (filters.dateFrom || filters.dateTo) {
                query.createdAt = {};
                if (filters.dateFrom)
                    query.createdAt.$gte = filters.dateFrom;
                if (filters.dateTo)
                    query.createdAt.$lte = filters.dateTo;
            }
            if (filters.closedDateFrom || filters.closedDateTo) {
                query.closedAt = {};
                if (filters.closedDateFrom)
                    query.closedAt.$gte = filters.closedDateFrom;
                if (filters.closedDateTo)
                    query.closedAt.$lte = filters.closedDateTo;
            }
            // Execute query with sorting and pagination
            let cursor = this.collection.find(query);
            // Apply sorting
            if (sort) {
                const sortDirection = sort.direction === 'asc' ? 1 : -1;
                cursor = cursor.sort({ [sort.field]: sortDirection });
            }
            else {
                // Default sort by creation date, newest first
                cursor = cursor.sort({ createdAt: -1 });
            }
            // Apply pagination
            if (pagination?.skip) {
                cursor = cursor.skip(pagination.skip);
            }
            if (pagination?.limit) {
                cursor = cursor.limit(pagination.limit);
            }
            const results = await cursor.toArray();
            return results;
        }
        catch (error) {
            throw error;
        }
    }
    async getActiveCases(guildId) {
        return this.findByFilters({
            guildId,
            status: case_1.CaseStatus.IN_PROGRESS
        });
    }
    async getPendingCases(guildId) {
        return this.findByGuildAndStatus(guildId, case_1.CaseStatus.PENDING);
    }
    async getClosedCases(guildId) {
        return this.findByGuildAndStatus(guildId, case_1.CaseStatus.CLOSED);
    }
    async getCaseStats(guildId) {
        const allCases = await this.findByFilters({ guildId });
        return {
            total: allCases.length,
            pending: allCases.filter(c => c.status === case_1.CaseStatus.PENDING).length,
            open: 0, // OPEN status removed
            inProgress: allCases.filter(c => c.status === case_1.CaseStatus.IN_PROGRESS).length,
            closed: allCases.filter(c => c.status === case_1.CaseStatus.CLOSED).length,
            wins: allCases.filter(c => c.result === case_1.CaseResult.WIN).length,
            losses: allCases.filter(c => c.result === case_1.CaseResult.LOSS).length,
            settlements: allCases.filter(c => c.result === case_1.CaseResult.SETTLEMENT).length
        };
    }
    async assignLawyer(caseId, lawyerId) {
        const existingCase = await this.findById(caseId);
        if (!existingCase)
            return null;
        // Check if lawyer is already assigned
        if (existingCase.assignedLawyerIds.includes(lawyerId)) {
            return existingCase;
        }
        const updatedLawyers = [...existingCase.assignedLawyerIds, lawyerId];
        // If no lead attorney, make this lawyer the lead
        const updates = {
            assignedLawyerIds: updatedLawyers
        };
        if (!existingCase.leadAttorneyId) {
            updates.leadAttorneyId = lawyerId;
        }
        return this.update(caseId, updates);
    }
    async unassignLawyer(caseId, lawyerId) {
        const existingCase = await this.findById(caseId);
        if (!existingCase)
            return null;
        const updatedLawyers = existingCase.assignedLawyerIds.filter(id => id !== lawyerId);
        const updates = {
            assignedLawyerIds: updatedLawyers
        };
        // If removing the lead attorney, assign new lead from remaining lawyers
        if (existingCase.leadAttorneyId === lawyerId) {
            updates.leadAttorneyId = updatedLawyers.length > 0 ? updatedLawyers[0] : undefined;
        }
        return this.update(caseId, updates);
    }
    async reassignLawyer(fromCaseId, toCaseId, lawyerId) {
        const fromCase = await this.unassignLawyer(fromCaseId, lawyerId);
        const toCase = await this.assignLawyer(toCaseId, lawyerId);
        return { fromCase, toCase };
    }
    async addDocument(caseId, document) {
        const existingCase = await this.findById(caseId);
        if (!existingCase)
            return null;
        const updatedDocuments = [...existingCase.documents, document];
        return this.update(caseId, { documents: updatedDocuments });
    }
    async addNote(caseId, note) {
        const existingCase = await this.findById(caseId);
        if (!existingCase)
            return null;
        const updatedNotes = [...existingCase.notes, note];
        return this.update(caseId, { notes: updatedNotes });
    }
}
exports.CaseRepository = CaseRepository;
//# sourceMappingURL=case-repository.js.map