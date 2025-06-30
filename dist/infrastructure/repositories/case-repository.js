"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const mongodb_1 = require("mongodb");
const validation_1 = require("../../validation");
// Validation schemas for the interfaces
const CaseSearchFiltersSchema = validation_1.z.object({
    guildId: validation_1.DiscordSnowflakeSchema.optional(),
    status: validation_1.CaseStatusSchema.optional(),
    priority: validation_1.CasePrioritySchema.optional(),
    result: validation_1.CaseResultSchema.optional(),
    clientId: validation_1.DiscordSnowflakeSchema.optional(),
    leadAttorneyId: validation_1.DiscordSnowflakeSchema.optional(),
    assignedLawyerId: validation_1.DiscordSnowflakeSchema.optional(),
    caseNumber: validation_1.z.string().optional(),
    title: validation_1.z.string().optional(),
    channelId: validation_1.DiscordSnowflakeSchema.optional(),
    dateFrom: validation_1.z.date().optional(),
    dateTo: validation_1.z.date().optional(),
    closedDateFrom: validation_1.z.date().optional(),
    closedDateTo: validation_1.z.date().optional(),
});
const CaseSortOptionsSchema = validation_1.z.object({
    field: validation_1.z.enum(['createdAt', 'updatedAt', 'closedAt', 'caseNumber', 'priority', 'status']),
    direction: validation_1.z.enum(['asc', 'desc']),
});
const CasePaginationOptionsSchema = validation_1.z.object({
    limit: validation_1.z.number().int().positive().max(100).optional(),
    skip: validation_1.z.number().int().nonnegative().optional(),
});
class CaseRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('cases');
    }
    async findByCaseNumber(caseNumber) {
        const validatedCaseNumber = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string().regex(/^\d{4}-\d{4}-.+$/), caseNumber, 'Case number');
        return this.findOne({ caseNumber: validatedCaseNumber });
    }
    async findByClient(clientId) {
        const validatedClientId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, clientId, 'Client ID');
        return this.findByFilters({ clientId: validatedClientId });
    }
    async findByStatus(status) {
        const validatedStatus = validation_1.ValidationHelpers.validateOrThrow(validation_1.CaseStatusSchema, status, 'Case status');
        return this.findByFilters({ status: validatedStatus });
    }
    async findByGuildAndStatus(guildId, status) {
        const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
        const validatedStatus = validation_1.ValidationHelpers.validateOrThrow(validation_1.CaseStatusSchema, status, 'Case status');
        return this.findByFilters({ guildId: validatedGuildId, status: validatedStatus });
    }
    async findByLawyer(lawyerId) {
        const validatedLawyerId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, lawyerId, 'Lawyer ID');
        const leadCases = await this.findByFilters({ leadAttorneyId: validatedLawyerId });
        const assignedCases = await this.findByFilters({ assignedLawyerIds: { $in: [validatedLawyerId] } });
        // Combine and deduplicate
        const allCases = [...leadCases, ...assignedCases];
        const uniqueCases = allCases.filter((case1, index, self) => index === self.findIndex(case2 => case1._id?.toString() === case2._id?.toString()));
        return uniqueCases;
    }
    async findByLeadAttorney(leadAttorneyId) {
        const validatedLeadAttorneyId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, leadAttorneyId, 'Lead attorney ID');
        return this.findByFilters({ leadAttorneyId: validatedLeadAttorneyId });
    }
    async findAssignedToLawyer(lawyerId) {
        const validatedLawyerId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, lawyerId, 'Lawyer ID');
        return this.findByFilters({ assignedLawyerIds: { $in: [validatedLawyerId] } });
    }
    async searchCases(filters, sort, pagination) {
        try {
            // Validate inputs
            const validatedFilters = validation_1.ValidationHelpers.validateOrThrow(CaseSearchFiltersSchema, filters, 'Case search filters');
            const validatedSort = sort ? validation_1.ValidationHelpers.validateOrThrow(CaseSortOptionsSchema, sort, 'Case sort options') : undefined;
            const validatedPagination = pagination ? validation_1.ValidationHelpers.validateOrThrow(CasePaginationOptionsSchema, pagination, 'Case pagination options') : undefined;
            // Build MongoDB query from filters
            const query = {};
            if (validatedFilters.guildId)
                query.guildId = validatedFilters.guildId;
            if (validatedFilters.status)
                query.status = validatedFilters.status;
            if (validatedFilters.priority)
                query.priority = validatedFilters.priority;
            if (validatedFilters.result)
                query.result = validatedFilters.result;
            if (validatedFilters.clientId)
                query.clientId = validatedFilters.clientId;
            if (validatedFilters.leadAttorneyId)
                query.leadAttorneyId = validatedFilters.leadAttorneyId;
            if (validatedFilters.assignedLawyerId)
                query.assignedLawyerIds = { $in: [validatedFilters.assignedLawyerId] };
            if (validatedFilters.caseNumber)
                query.caseNumber = { $regex: validatedFilters.caseNumber, $options: 'i' };
            if (validatedFilters.title)
                query.title = { $regex: validatedFilters.title, $options: 'i' };
            // Date range filters
            if (validatedFilters.dateFrom || validatedFilters.dateTo) {
                query.createdAt = {};
                if (validatedFilters.dateFrom)
                    query.createdAt.$gte = validatedFilters.dateFrom;
                if (validatedFilters.dateTo)
                    query.createdAt.$lte = validatedFilters.dateTo;
            }
            if (validatedFilters.closedDateFrom || validatedFilters.closedDateTo) {
                query.closedAt = {};
                if (validatedFilters.closedDateFrom)
                    query.closedAt.$gte = validatedFilters.closedDateFrom;
                if (validatedFilters.closedDateTo)
                    query.closedAt.$lte = validatedFilters.closedDateTo;
            }
            // Execute query with sorting and pagination
            let cursor = this.collection.find(query);
            // Apply sorting
            if (validatedSort) {
                const sortDirection = validatedSort.direction === 'asc' ? 1 : -1;
                cursor = cursor.sort({ [validatedSort.field]: sortDirection });
            }
            else {
                // Default sort by creation date, newest first
                cursor = cursor.sort({ createdAt: -1 });
            }
            // Apply pagination
            if (validatedPagination?.skip) {
                cursor = cursor.skip(validatedPagination.skip);
            }
            if (validatedPagination?.limit) {
                cursor = cursor.limit(validatedPagination.limit);
            }
            const results = await cursor.toArray();
            return results.map(doc => this.fromMongoDoc(doc)).filter(doc => doc !== null);
        }
        catch (error) {
            throw error;
        }
    }
    async getActiveCases(guildId) {
        const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
        return this.findByFilters({
            guildId: validatedGuildId,
            status: 'in-progress'
        });
    }
    async getPendingCases(guildId) {
        return this.findByGuildAndStatus(guildId, 'pending');
    }
    async getClosedCases(guildId) {
        return this.findByGuildAndStatus(guildId, 'closed');
    }
    async getCaseStats(guildId) {
        const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
        const allCases = await this.findByFilters({ guildId: validatedGuildId });
        return {
            total: allCases.length,
            pending: allCases.filter(c => c.status === 'pending').length,
            open: 0, // OPEN status removed
            inProgress: allCases.filter(c => c.status === 'in-progress').length,
            closed: allCases.filter(c => c.status === 'closed').length,
            wins: allCases.filter(c => c.result === 'win').length,
            losses: allCases.filter(c => c.result === 'loss').length,
            settlements: allCases.filter(c => c.result === 'settlement').length
        };
    }
    async assignLawyer(caseId, lawyerId) {
        const validatedCaseId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), caseId, 'Case ID');
        const validatedLawyerId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, lawyerId, 'Lawyer ID');
        const existingCase = await this.findById(validatedCaseId);
        if (!existingCase)
            return null;
        // Check if lawyer is already assigned
        if (existingCase.assignedLawyerIds.includes(validatedLawyerId)) {
            return existingCase;
        }
        const updatedLawyers = [...existingCase.assignedLawyerIds, validatedLawyerId];
        // If no lead attorney, make this lawyer the lead
        const updates = {
            assignedLawyerIds: updatedLawyers
        };
        if (!existingCase.leadAttorneyId) {
            updates.leadAttorneyId = validatedLawyerId;
        }
        return this.update(validatedCaseId, updates);
    }
    async unassignLawyer(caseId, lawyerId) {
        const validatedCaseId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), caseId, 'Case ID');
        const validatedLawyerId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, lawyerId, 'Lawyer ID');
        const existingCase = await this.findById(validatedCaseId);
        if (!existingCase)
            return null;
        const updatedLawyers = existingCase.assignedLawyerIds.filter(id => id !== validatedLawyerId);
        const updates = {
            assignedLawyerIds: updatedLawyers
        };
        // If removing the lead attorney, assign new lead from remaining lawyers
        if (existingCase.leadAttorneyId === validatedLawyerId) {
            updates.leadAttorneyId = updatedLawyers.length > 0 ? updatedLawyers[0] : undefined;
        }
        return this.update(validatedCaseId, updates);
    }
    async reassignLawyer(fromCaseId, toCaseId, lawyerId) {
        // Validation is handled by the called methods
        const fromCase = await this.unassignLawyer(fromCaseId, lawyerId);
        const toCase = await this.assignLawyer(toCaseId, lawyerId);
        return { fromCase, toCase };
    }
    async addDocument(caseId, document) {
        const validatedCaseId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), caseId, 'Case ID');
        // Create a document schema matching CaseDocument interface
        const documentSchema = validation_1.z.object({
            id: validation_1.z.string(),
            title: validation_1.z.string(),
            content: validation_1.z.string(),
            createdBy: validation_1.DiscordSnowflakeSchema,
            createdAt: validation_1.z.date()
        });
        const validatedDocument = validation_1.ValidationHelpers.validateOrThrow(documentSchema, document, 'Document');
        const existingCase = await this.findById(validatedCaseId);
        if (!existingCase)
            return null;
        const updatedDocuments = [...existingCase.documents, validatedDocument];
        return this.update(validatedCaseId, { documents: updatedDocuments });
    }
    async addNote(caseId, note) {
        const validatedCaseId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), caseId, 'Case ID');
        // Create a note schema matching CaseNote interface
        const noteSchema = validation_1.z.object({
            id: validation_1.z.string(),
            content: validation_1.z.string(),
            createdBy: validation_1.DiscordSnowflakeSchema,
            createdAt: validation_1.z.date(),
            isInternal: validation_1.z.boolean()
        });
        const validatedNote = validation_1.ValidationHelpers.validateOrThrow(noteSchema, note, 'Note');
        const existingCase = await this.findById(validatedCaseId);
        if (!existingCase)
            return null;
        const updatedNotes = [...existingCase.notes, validatedNote];
        return this.update(validatedCaseId, { notes: updatedNotes });
    }
    /**
     * Find all cases where a user is involved (as client, lead attorney, or assigned lawyer)
     */
    async findCasesByUserId(guildId, userId) {
        try {
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedUserId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, userId, 'User ID');
            const query = {
                guildId: validatedGuildId,
                $or: [
                    { clientId: validatedUserId },
                    { leadAttorneyId: validatedUserId },
                    { assignedLawyerIds: { $in: [validatedUserId] } }
                ]
            };
            return await this.findByFilters(query);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Conditionally update a case only if it matches certain criteria
     * This prevents race conditions by checking and updating in a single atomic operation
     */
    async conditionalUpdate(caseId, conditions, updates) {
        try {
            const validatedCaseId = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string(), caseId, 'Case ID');
            if (!mongodb_1.ObjectId.isValid(validatedCaseId)) {
                return null;
            }
            // Validate conditions and updates as partial Case objects
            const partialCaseSchema = validation_1.z.object({
                status: validation_1.CaseStatusSchema.optional(),
                priority: validation_1.CasePrioritySchema.optional(),
                result: validation_1.CaseResultSchema.optional(),
                // Add other fields as needed
            }).passthrough(); // Allow additional fields
            const validatedConditions = validation_1.ValidationHelpers.validateOrThrow(partialCaseSchema, conditions, 'Conditions');
            const validatedUpdates = validation_1.ValidationHelpers.validateOrThrow(partialCaseSchema, updates, 'Updates');
            const query = { _id: new mongodb_1.ObjectId(validatedCaseId), ...validatedConditions };
            const updateDoc = { $set: { ...validatedUpdates, updatedAt: new Date() } };
            const result = await this.collection.findOneAndUpdate(query, updateDoc, { returnDocument: 'after' });
            return result ? this.fromMongoDoc(result) : null;
        }
        catch (error) {
            throw error;
        }
    }
}
exports.CaseRepository = CaseRepository;
//# sourceMappingURL=case-repository.js.map