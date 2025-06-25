import { Retainer, RetainerCreationRequest, RetainerSignatureRequest, FormattedRetainerAgreement } from '../../domain/entities/retainer';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { RobloxService } from '../../infrastructure/external/roblox-service';
import { PermissionService, PermissionContext } from './permission-service';
export declare class RetainerService {
    private retainerRepository;
    private guildConfigRepository;
    private robloxService;
    private permissionService;
    constructor(retainerRepository: RetainerRepository, guildConfigRepository: GuildConfigRepository, robloxService: RobloxService, permissionService: PermissionService);
    createRetainer(context: PermissionContext, request: RetainerCreationRequest): Promise<Retainer>;
    signRetainer(request: RetainerSignatureRequest): Promise<Retainer>;
    cancelRetainer(context: PermissionContext, retainerId: string): Promise<Retainer>;
    getActiveRetainers(context: PermissionContext): Promise<Retainer[]>;
    getPendingRetainers(context: PermissionContext): Promise<Retainer[]>;
    getClientRetainers(context: PermissionContext, clientId: string, includeAll?: boolean): Promise<Retainer[]>;
    getRetainerStats(context: PermissionContext): Promise<{
        total: number;
        active: number;
        pending: number;
        cancelled: number;
    }>;
    formatRetainerAgreement(retainer: Retainer, clientName: string, lawyerName: string): Promise<FormattedRetainerAgreement>;
    hasClientRole(guildId: string): Promise<boolean>;
    getClientRoleId(guildId: string): Promise<string | null>;
    getRetainerChannelId(guildId: string): Promise<string | null>;
}
//# sourceMappingURL=retainer-service.d.ts.map