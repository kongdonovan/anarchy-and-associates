"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseService = void 0;
const case_1 = require("../../domain/entities/case");
const logger_1 = require("../../infrastructure/logger");
const crypto_1 = require("crypto");
class CaseService {
    constructor(caseRepository, caseCounterRepository, guildConfigRepository) {
        this.caseRepository = caseRepository;
        this.caseCounterRepository = caseCounterRepository;
        this.guildConfigRepository = guildConfigRepository;
    }
    async createCase(request) {
        logger_1.logger.info('Creating new case', {
            guildId: request.guildId,
            clientId: request.clientId,
            title: request.title
        });
        // Generate sequential case number
        const caseCount = await this.caseCounterRepository.getNextCaseNumber(request.guildId);
        const currentYear = new Date().getFullYear();
        const caseNumber = (0, case_1.generateCaseNumber)(currentYear, caseCount, request.clientUsername);
        const caseData = {
            guildId: request.guildId,
            caseNumber,
            clientId: request.clientId,
            clientUsername: request.clientUsername,
            title: request.title,
            description: request.description,
            status: case_1.CaseStatus.PENDING,
            priority: request.priority || case_1.CasePriority.MEDIUM,
            assignedLawyerIds: [],
            documents: [],
            notes: []
        };
        const createdCase = await this.caseRepository.add(caseData);
        logger_1.logger.info('Case created successfully', {
            caseId: createdCase._id,
            caseNumber: createdCase.caseNumber,
            clientId: request.clientId
        });
        return createdCase;
    }
    async assignLawyer(request) {
        logger_1.logger.info('Assigning lawyer to case', {
            caseId: request.caseId,
            lawyerId: request.lawyerId,
            assignedBy: request.assignedBy
        });
        const updatedCase = await this.caseRepository.assignLawyer(request.caseId, request.lawyerId);
        if (!updatedCase) {
            throw new Error('Case not found or assignment failed');
        }
        logger_1.logger.info('Lawyer assigned successfully', {
            caseId: request.caseId,
            lawyerId: request.lawyerId,
            isLeadAttorney: updatedCase.leadAttorneyId === request.lawyerId
        });
        return updatedCase;
    }
    async unassignLawyer(caseId, lawyerId) {
        logger_1.logger.info('Unassigning lawyer from case', { caseId, lawyerId });
        const updatedCase = await this.caseRepository.unassignLawyer(caseId, lawyerId);
        if (!updatedCase) {
            throw new Error('Case not found or unassignment failed');
        }
        logger_1.logger.info('Lawyer unassigned successfully', { caseId, lawyerId });
        return updatedCase;
    }
    async reassignLawyer(fromCaseId, toCaseId, lawyerId) {
        logger_1.logger.info('Reassigning lawyer between cases', { fromCaseId, toCaseId, lawyerId });
        const result = await this.caseRepository.reassignLawyer(fromCaseId, toCaseId, lawyerId);
        if (!result.fromCase || !result.toCase) {
            throw new Error('One or both cases not found, or reassignment failed');
        }
        logger_1.logger.info('Lawyer reassigned successfully', { fromCaseId, toCaseId, lawyerId });
        return result;
    }
    async updateCaseStatus(caseId, status, updatedBy) {
        logger_1.logger.info('Updating case status', { caseId, status, updatedBy });
        const updatedCase = await this.caseRepository.update(caseId, { status });
        if (!updatedCase) {
            throw new Error('Case not found or status update failed');
        }
        logger_1.logger.info('Case status updated successfully', { caseId, status });
        return updatedCase;
    }
    async closeCase(request) {
        logger_1.logger.info('Closing case', {
            caseId: request.caseId,
            result: request.result,
            closedBy: request.closedBy
        });
        const updatedCase = await this.caseRepository.update(request.caseId, {
            status: case_1.CaseStatus.CLOSED,
            result: request.result,
            resultNotes: request.resultNotes,
            closedAt: new Date(),
            closedBy: request.closedBy
        });
        if (!updatedCase) {
            throw new Error('Case not found or closure failed');
        }
        logger_1.logger.info('Case closed successfully', {
            caseId: request.caseId,
            result: request.result
        });
        return updatedCase;
    }
    async updateCase(request) {
        const updates = {};
        if (request.title !== undefined)
            updates.title = request.title;
        if (request.description !== undefined)
            updates.description = request.description;
        if (request.priority !== undefined)
            updates.priority = request.priority;
        if (request.status !== undefined)
            updates.status = request.status;
        const updatedCase = await this.caseRepository.update(request.caseId, updates);
        if (!updatedCase) {
            throw new Error('Case not found or update failed');
        }
        return updatedCase;
    }
    async addDocument(caseId, title, content, createdBy) {
        const document = {
            id: (0, crypto_1.randomUUID)(),
            title,
            content,
            createdBy,
            createdAt: new Date()
        };
        const updatedCase = await this.caseRepository.addDocument(caseId, document);
        if (!updatedCase) {
            throw new Error('Case not found or document addition failed');
        }
        logger_1.logger.info('Document added to case', { caseId, documentId: document.id, title });
        return updatedCase;
    }
    async addNote(caseId, content, createdBy, isInternal = false) {
        const note = {
            id: (0, crypto_1.randomUUID)(),
            content,
            createdBy,
            createdAt: new Date(),
            isInternal
        };
        const updatedCase = await this.caseRepository.addNote(caseId, note);
        if (!updatedCase) {
            throw new Error('Case not found or note addition failed');
        }
        logger_1.logger.info('Note added to case', { caseId, noteId: note.id, isInternal });
        return updatedCase;
    }
    async searchCases(filters, sort, pagination) {
        return this.caseRepository.searchCases(filters, sort, pagination);
    }
    async getCaseById(caseId) {
        return this.caseRepository.findById(caseId);
    }
    async getCaseByCaseNumber(caseNumber) {
        return this.caseRepository.findByCaseNumber(caseNumber);
    }
    async getCasesByClient(clientId) {
        return this.caseRepository.findByClient(clientId);
    }
    async getCasesByLawyer(lawyerId) {
        return this.caseRepository.findByLawyer(lawyerId);
    }
    async getActiveCases(guildId) {
        return this.caseRepository.getActiveCases(guildId);
    }
    async getPendingCases(guildId) {
        return this.caseRepository.getPendingCases(guildId);
    }
    async getCaseStats(guildId) {
        return this.caseRepository.getCaseStats(guildId);
    }
    async getCaseReviewCategoryId(guildId) {
        const config = await this.guildConfigRepository.findByGuildId(guildId);
        return config?.caseReviewCategoryId || null;
    }
    async getCaseArchiveCategoryId(guildId) {
        const config = await this.guildConfigRepository.findByGuildId(guildId);
        return config?.caseArchiveCategoryId || null;
    }
    generateChannelName(caseNumber) {
        return (0, case_1.generateChannelName)(caseNumber);
    }
    async acceptCase(caseId, acceptedBy) {
        logger_1.logger.info('Accepting case', { caseId, acceptedBy });
        // Update status to open and assign the accepting lawyer as lead attorney
        const updatedCase = await this.caseRepository.update(caseId, {
            status: case_1.CaseStatus.OPEN,
            leadAttorneyId: acceptedBy,
            assignedLawyerIds: [acceptedBy]
        });
        if (!updatedCase) {
            throw new Error('Case not found or acceptance failed');
        }
        logger_1.logger.info('Case accepted successfully', {
            caseId,
            acceptedBy,
            leadAttorney: acceptedBy
        });
        return updatedCase;
    }
    async declineCase(caseId, declinedBy, reason) {
        logger_1.logger.info('Declining case', { caseId, declinedBy, reason });
        // For now, we'll set status to closed with a specific result
        // In a more complex system, you might want a separate "declined" status
        const updatedCase = await this.caseRepository.update(caseId, {
            status: case_1.CaseStatus.CLOSED,
            result: case_1.CaseResult.DISMISSED,
            resultNotes: reason || 'Case declined by staff',
            closedAt: new Date(),
            closedBy: declinedBy
        });
        if (!updatedCase) {
            throw new Error('Case not found or decline failed');
        }
        logger_1.logger.info('Case declined successfully', { caseId, declinedBy });
        return updatedCase;
    }
}
exports.CaseService = CaseService;
//# sourceMappingURL=case-service.js.map