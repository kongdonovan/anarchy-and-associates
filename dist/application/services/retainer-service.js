"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetainerService = void 0;
const retainer_1 = require("../../domain/entities/retainer");
const logger_1 = require("../../infrastructure/logger");
class RetainerService {
    constructor(retainerRepository, guildConfigRepository, robloxService, permissionService) {
        this.retainerRepository = retainerRepository;
        this.guildConfigRepository = guildConfigRepository;
        this.robloxService = robloxService;
        this.permissionService = permissionService;
    }
    async createRetainer(context, request) {
        // Check retainer permission
        const hasPermission = await this.permissionService.hasRetainerPermissionWithContext(context);
        if (!hasPermission) {
            throw new Error('You do not have permission to create retainer agreements');
        }
        logger_1.logger.info('Creating retainer agreement', {
            guildId: request.guildId,
            clientId: request.clientId,
            lawyerId: request.lawyerId
        });
        // Check if client already has a pending retainer
        const hasPending = await this.retainerRepository.hasPendingRetainer(request.clientId);
        if (hasPending) {
            throw new Error('Client already has a pending retainer agreement');
        }
        // Check if client already has an active retainer
        const hasActive = await this.retainerRepository.hasActiveRetainer(request.clientId);
        if (hasActive) {
            throw new Error('Client already has an active retainer agreement');
        }
        const retainer = {
            guildId: request.guildId,
            clientId: request.clientId,
            lawyerId: request.lawyerId,
            status: retainer_1.RetainerStatus.PENDING,
            agreementTemplate: retainer_1.STANDARD_RETAINER_TEMPLATE
        };
        const createdRetainer = await this.retainerRepository.add(retainer);
        logger_1.logger.info('Retainer agreement created', {
            retainerId: createdRetainer._id,
            clientId: request.clientId,
            lawyerId: request.lawyerId
        });
        return createdRetainer;
    }
    async signRetainer(request) {
        logger_1.logger.info('Processing retainer signature', {
            retainerId: request.retainerId,
            clientRobloxUsername: request.clientRobloxUsername
        });
        const retainer = await this.retainerRepository.findById(request.retainerId);
        if (!retainer) {
            throw new Error('Retainer agreement not found');
        }
        if (retainer.status !== retainer_1.RetainerStatus.PENDING) {
            throw new Error('Retainer agreement is not in pending status');
        }
        // Validate Roblox username (optional - continues if fails)
        try {
            const robloxValidation = await this.robloxService.validateUsername(request.clientRobloxUsername);
            if (!robloxValidation.isValid) {
                logger_1.logger.warn('Roblox username validation failed, but continuing with signature', {
                    username: request.clientRobloxUsername,
                    error: robloxValidation.error
                });
            }
        }
        catch (error) {
            logger_1.logger.warn('Roblox validation service failed, continuing without validation', {
                username: request.clientRobloxUsername,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        const signedRetainer = await this.retainerRepository.update(request.retainerId, {
            status: retainer_1.RetainerStatus.SIGNED,
            clientRobloxUsername: request.clientRobloxUsername,
            digitalSignature: request.clientRobloxUsername,
            signedAt: new Date()
        });
        if (!signedRetainer) {
            throw new Error('Failed to update retainer agreement');
        }
        logger_1.logger.info('Retainer agreement signed successfully', {
            retainerId: request.retainerId,
            clientRobloxUsername: request.clientRobloxUsername
        });
        return signedRetainer;
    }
    async cancelRetainer(context, retainerId) {
        // Check retainer permission
        const hasPermission = await this.permissionService.hasRetainerPermissionWithContext(context);
        if (!hasPermission) {
            throw new Error('You do not have permission to cancel retainer agreements');
        }
        logger_1.logger.info('Cancelling retainer agreement', {
            retainerId,
            cancelledBy: context.userId
        });
        const retainer = await this.retainerRepository.findById(retainerId);
        if (!retainer) {
            throw new Error('Retainer agreement not found');
        }
        if (retainer.status !== retainer_1.RetainerStatus.PENDING) {
            throw new Error('Only pending retainer agreements can be cancelled');
        }
        const cancelledRetainer = await this.retainerRepository.update(retainerId, {
            status: retainer_1.RetainerStatus.CANCELLED
        });
        if (!cancelledRetainer) {
            throw new Error('Failed to cancel retainer agreement');
        }
        logger_1.logger.info('Retainer agreement cancelled', {
            retainerId,
            cancelledBy: context.userId
        });
        return cancelledRetainer;
    }
    async getActiveRetainers(context) {
        // Check retainer permission
        const hasPermission = await this.permissionService.hasRetainerPermissionWithContext(context);
        if (!hasPermission) {
            throw new Error('You do not have permission to view retainer agreements');
        }
        return this.retainerRepository.findActiveRetainers(context.guildId);
    }
    async getPendingRetainers(context) {
        // Check retainer permission
        const hasPermission = await this.permissionService.hasRetainerPermissionWithContext(context);
        if (!hasPermission) {
            throw new Error('You do not have permission to view pending retainer agreements');
        }
        return this.retainerRepository.findPendingRetainers(context.guildId);
    }
    async getClientRetainers(context, clientId, includeAll = false) {
        // Users can view their own retainers, or staff with retainer permission can view any
        const isOwnRetainers = context.userId === clientId;
        const hasRetainerPermission = await this.permissionService.hasRetainerPermissionWithContext(context);
        if (!isOwnRetainers && !hasRetainerPermission) {
            throw new Error('You do not have permission to view these retainer agreements');
        }
        return this.retainerRepository.findClientRetainers(clientId, includeAll);
    }
    async getRetainerStats(context) {
        // Check retainer permission
        const hasPermission = await this.permissionService.hasRetainerPermissionWithContext(context);
        if (!hasPermission) {
            throw new Error('You do not have permission to view retainer statistics');
        }
        return this.retainerRepository.getRetainerStats(context.guildId);
    }
    async formatRetainerAgreement(retainer, clientName, lawyerName) {
        if (retainer.status !== retainer_1.RetainerStatus.SIGNED) {
            throw new Error('Cannot format unsigned retainer agreement');
        }
        if (!retainer.clientRobloxUsername || !retainer.signedAt) {
            throw new Error('Retainer agreement is missing signature information');
        }
        const formattedText = retainer.agreementTemplate
            .replace('[CLIENT_NAME]', clientName)
            .replace('[SIGNATURE]', retainer.digitalSignature || retainer.clientRobloxUsername)
            .replace('[DATE]', retainer.signedAt.toDateString())
            .replace('[LAWYER_NAME]', lawyerName);
        return {
            clientName,
            clientRobloxUsername: retainer.clientRobloxUsername,
            lawyerName,
            signedAt: retainer.signedAt,
            agreementText: formattedText
        };
    }
    async hasClientRole(guildId) {
        const config = await this.guildConfigRepository.findByGuildId(guildId);
        return !!config?.clientRoleId;
    }
    async getClientRoleId(guildId) {
        const config = await this.guildConfigRepository.findByGuildId(guildId);
        return config?.clientRoleId || null;
    }
    async getRetainerChannelId(guildId) {
        const config = await this.guildConfigRepository.findByGuildId(guildId);
        return config?.retainerChannelId || null;
    }
}
exports.RetainerService = RetainerService;
//# sourceMappingURL=retainer-service.js.map