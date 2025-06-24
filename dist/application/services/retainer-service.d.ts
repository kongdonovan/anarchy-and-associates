import { Retainer, RetainerCreationRequest, RetainerSignatureRequest, FormattedRetainerAgreement } from '../../domain/entities/retainer';
import { RetainerRepository } from '../../infrastructure/repositories/retainer-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { RobloxService } from '../../infrastructure/external/roblox-service';
export declare class RetainerService {
    private retainerRepository;
    private guildConfigRepository;
    private robloxService;
    constructor(retainerRepository: RetainerRepository, guildConfigRepository: GuildConfigRepository, robloxService: RobloxService);
    createRetainer(request: RetainerCreationRequest): Promise<Retainer>;
    signRetainer(request: RetainerSignatureRequest): Promise<Retainer>;
    cancelRetainer(retainerId: string, cancelledBy: string): Promise<Retainer>;
    getActiveRetainers(guildId: string): Promise<Retainer[]>;
    getPendingRetainers(guildId: string): Promise<Retainer[]>;
    getClientRetainers(clientId: string, includeAll?: boolean): Promise<Retainer[]>;
    getRetainerStats(guildId: string): Promise<{
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