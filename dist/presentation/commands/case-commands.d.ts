import { CommandInteraction, ButtonInteraction, ModalSubmitInteraction, User, StringSelectMenuInteraction } from 'discord.js';
import { BaseCommand } from './base-command';
export declare class CaseCommands extends BaseCommand {
    private caseService;
    private caseRepository;
    private auditLogRepository;
    private feedbackRepository;
    private static caseTemplates;
    constructor();
    private getCaseServiceWithClient;
    reviewCase(details: string, interaction: CommandInteraction): Promise<void>;
    assignCase(lawyer: User, interaction: CommandInteraction): Promise<void>;
    transferCase(caseNumber: string, fromLawyer: User, toLawyer: User, reason: string | undefined, interaction: CommandInteraction): Promise<void>;
    bulkCloseCases(result: string, interaction: CommandInteraction): Promise<void>;
    handleBulkCloseSelection(interaction: StringSelectMenuInteraction): Promise<void>;
    caseAnalytics(period: number | undefined, interaction: CommandInteraction): Promise<void>;
    createTemplate(name: string, description: string, priority: string, defaultTitle: string | undefined, interaction: CommandInteraction): Promise<void>;
    useTemplate(details: string, interaction: CommandInteraction): Promise<void>;
    handleTemplateSelection(interaction: StringSelectMenuInteraction): Promise<void>;
    debugPermissions(caseNumber: string, user: User, interaction: CommandInteraction): Promise<void>;
    closeCase(result: string, notes: string | undefined, interaction: CommandInteraction): Promise<void>;
    listCases(status: string | undefined, lawyer: User | undefined, search: string | undefined, page: number | undefined, interaction: CommandInteraction): Promise<void>;
    reassignStaff(staff: User, newCaseChannel: any, interaction: CommandInteraction): Promise<void>;
    unassignStaff(staff: User, interaction: CommandInteraction): Promise<void>;
    caseInfo(caseNumber: string | undefined, interaction: CommandInteraction): Promise<void>;
    private showCaseInfoTab;
    private buildOverviewTab;
    private buildDocumentsTab;
    private buildNotesTab;
    private buildTimelineTab;
    handleTabNavigation(interaction: ButtonInteraction): Promise<void>;
    setLeadAttorney(attorney: User, interaction: CommandInteraction): Promise<void>;
    private createCaseChannel;
    private sendCaseOverview;
    handleCaseAccept(interaction: ButtonInteraction): Promise<void>;
    handleCaseClose(interaction: ButtonInteraction): Promise<void>;
    handleCaseDecline(interaction: ButtonInteraction): Promise<void>;
    handleCaseCloseModal(interaction: ModalSubmitInteraction): Promise<void>;
    handleDeclineReason(interaction: ModalSubmitInteraction): Promise<void>;
    private archiveCaseChannel;
    private getCaseFromChannel;
    private updateCaseOverviewMessage;
    searchCases(searchQuery: string | undefined, status: string | undefined, priority: string | undefined, lawyer: User | undefined, client: User | undefined, daysAgo: number | undefined, interaction: CommandInteraction): Promise<void>;
    exportCases(format: string | undefined, interaction: CommandInteraction): Promise<void>;
    addCaseNote(content: string, clientVisible: boolean | undefined, interaction: CommandInteraction): Promise<void>;
    /**
     * Generate CSV from cases
     */
    private generateCaseCSV;
    /**
     * Generate summary report from cases
     */
    private generateCaseSummaryReport;
    /**
     * Get case status emoji
     */
    private getCaseStatusEmoji;
    /**
     * Get case priority emoji
     */
    private getCasePriorityEmoji;
    private analyzeTrends;
}
//# sourceMappingURL=case-commands.d.ts.map