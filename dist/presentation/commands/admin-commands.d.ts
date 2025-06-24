import { User, Role, CommandInteraction, ModalSubmitInteraction } from 'discord.js';
export declare class AdminCommands {
    private guildConfigRepository;
    private permissionService;
    private anarchySetupService;
    private staffRepository;
    private jobRepository;
    private applicationRepository;
    private caseRepository;
    private feedbackRepository;
    private retainerRepository;
    private reminderRepository;
    private auditLogRepository;
    private caseCounterRepository;
    constructor();
    private getPermissionContext;
    private createErrorEmbed;
    private createSuccessEmbed;
    private checkAdminPermission;
    addAdmin(user: User, interaction: CommandInteraction): Promise<void>;
    removeAdmin(user: User, interaction: CommandInteraction): Promise<void>;
    grantRole(role: Role, interaction: CommandInteraction): Promise<void>;
    revokeRole(role: Role, interaction: CommandInteraction): Promise<void>;
    listAdmins(interaction: CommandInteraction): Promise<void>;
    setPermissionRole(action: 'admin' | 'hr' | 'case' | 'config' | 'retainer' | 'repair', role: Role, interaction: CommandInteraction): Promise<void>;
    debugCollection(collection: 'staff' | 'jobs' | 'applications' | 'cases' | 'feedback' | 'retainers' | 'reminders' | 'auditLogs' | 'caseCounters' | 'guildConfig', interaction: CommandInteraction): Promise<void>;
    debugWipeCollections(interaction: CommandInteraction): Promise<void>;
    handleWipeConfirmation(interaction: ModalSubmitInteraction): Promise<void>;
    setupServer(interaction: CommandInteraction): Promise<void>;
    handleSetupConfirmation(interaction: ModalSubmitInteraction): Promise<void>;
}
//# sourceMappingURL=admin-commands.d.ts.map