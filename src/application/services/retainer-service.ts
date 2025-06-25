import { 
  Retainer, 
  RetainerStatus, 
  RetainerCreationRequest, 
  RetainerSignatureRequest,
  FormattedRetainerAgreement,
  STANDARD_RETAINER_TEMPLATE 
} from '../../domain/entities/retainer';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { RobloxService } from '../../infrastructure/external/roblox-service';
import { PermissionService, PermissionContext } from './permission-service';
import { logger } from '../../infrastructure/logger';

export class RetainerService {
  constructor(
    private retainerRepository: RetainerRepository,
    private guildConfigRepository: GuildConfigRepository,
    private robloxService: RobloxService,
    private permissionService: PermissionService
  ) {}

  public async createRetainer(context: PermissionContext, request: RetainerCreationRequest): Promise<Retainer> {
    // Check lawyer permission (updated from retainer permission)
    const hasPermission = await this.permissionService.hasLawyerPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to create retainer agreements');
    }

    logger.info('Creating retainer agreement', {
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

    const retainer: Omit<Retainer, '_id' | 'createdAt' | 'updatedAt'> = {
      guildId: request.guildId,
      clientId: request.clientId,
      lawyerId: request.lawyerId,
      status: RetainerStatus.PENDING,
      agreementTemplate: STANDARD_RETAINER_TEMPLATE
    };

    const createdRetainer = await this.retainerRepository.add(retainer);
    
    logger.info('Retainer agreement created', {
      retainerId: createdRetainer._id,
      clientId: request.clientId,
      lawyerId: request.lawyerId
    });

    return createdRetainer;
  }

  public async signRetainer(request: RetainerSignatureRequest): Promise<Retainer> {
    logger.info('Processing retainer signature', {
      retainerId: request.retainerId,
      clientRobloxUsername: request.clientRobloxUsername
    });

    const retainer = await this.retainerRepository.findById(request.retainerId);
    if (!retainer) {
      throw new Error('Retainer agreement not found');
    }

    if (retainer.status !== RetainerStatus.PENDING) {
      throw new Error('Retainer agreement is not in pending status');
    }

    // Validate Roblox username (optional - continues if fails)
    try {
      const robloxValidation = await this.robloxService.validateUsername(request.clientRobloxUsername);
      if (!robloxValidation.isValid) {
        logger.warn('Roblox username validation failed, but continuing with signature', {
          username: request.clientRobloxUsername,
          error: robloxValidation.error
        });
      }
    } catch (error) {
      logger.warn('Roblox validation service failed, continuing without validation', {
        username: request.clientRobloxUsername,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    const signedRetainer = await this.retainerRepository.update(request.retainerId, {
      status: RetainerStatus.SIGNED,
      clientRobloxUsername: request.clientRobloxUsername,
      digitalSignature: request.clientRobloxUsername,
      signedAt: new Date()
    });

    if (!signedRetainer) {
      throw new Error('Failed to update retainer agreement');
    }

    logger.info('Retainer agreement signed successfully', {
      retainerId: request.retainerId,
      clientRobloxUsername: request.clientRobloxUsername
    });

    return signedRetainer;
  }

  public async cancelRetainer(context: PermissionContext, retainerId: string): Promise<Retainer> {
    // Check lawyer permission (updated from retainer permission)
    const hasPermission = await this.permissionService.hasLawyerPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to cancel retainer agreements');
    }

    logger.info('Cancelling retainer agreement', {
      retainerId,
      cancelledBy: context.userId
    });

    const retainer = await this.retainerRepository.findById(retainerId);
    if (!retainer) {
      throw new Error('Retainer agreement not found');
    }

    if (retainer.status !== RetainerStatus.PENDING) {
      throw new Error('Only pending retainer agreements can be cancelled');
    }

    const cancelledRetainer = await this.retainerRepository.update(retainerId, {
      status: RetainerStatus.CANCELLED
    });

    if (!cancelledRetainer) {
      throw new Error('Failed to cancel retainer agreement');
    }

    logger.info('Retainer agreement cancelled', {
      retainerId,
      cancelledBy: context.userId
    });

    return cancelledRetainer;
  }

  public async getActiveRetainers(context: PermissionContext): Promise<Retainer[]> {
    // Check lawyer permission (updated from retainer permission)
    const hasPermission = await this.permissionService.hasLawyerPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to view retainer agreements');
    }

    return this.retainerRepository.findActiveRetainers(context.guildId);
  }

  public async getPendingRetainers(context: PermissionContext): Promise<Retainer[]> {
    // Check lawyer permission (updated from retainer permission)
    const hasPermission = await this.permissionService.hasLawyerPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to view pending retainer agreements');
    }

    return this.retainerRepository.findPendingRetainers(context.guildId);
  }

  public async getClientRetainers(context: PermissionContext, clientId: string, includeAll = false): Promise<Retainer[]> {
    // Users can view their own retainers, or staff with lawyer permission can view any
    const isOwnRetainers = context.userId === clientId;
    const hasLawyerPermission = await this.permissionService.hasLawyerPermissionWithContext(context);
    
    if (!isOwnRetainers && !hasLawyerPermission) {
      throw new Error('You do not have permission to view these retainer agreements');
    }

    return this.retainerRepository.findClientRetainers(clientId, includeAll);
  }

  public async getRetainerStats(context: PermissionContext): Promise<{
    total: number;
    active: number;
    pending: number;
    cancelled: number;
  }> {
    // Check lawyer permission (updated from retainer permission)
    const hasPermission = await this.permissionService.hasLawyerPermissionWithContext(context);
    if (!hasPermission) {
      throw new Error('You do not have permission to view retainer statistics');
    }

    return this.retainerRepository.getRetainerStats(context.guildId);
  }

  public async formatRetainerAgreement(retainer: Retainer, clientName: string, lawyerName: string): Promise<FormattedRetainerAgreement> {
    if (retainer.status !== RetainerStatus.SIGNED) {
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

  public async hasClientRole(guildId: string): Promise<boolean> {
    const config = await this.guildConfigRepository.findByGuildId(guildId);
    return !!config?.clientRoleId;
  }

  public async getClientRoleId(guildId: string): Promise<string | null> {
    const config = await this.guildConfigRepository.findByGuildId(guildId);
    return config?.clientRoleId || null;
  }

  public async getRetainerChannelId(guildId: string): Promise<string | null> {
    const config = await this.guildConfigRepository.findByGuildId(guildId);
    return config?.retainerChannelId || null;
  }
}