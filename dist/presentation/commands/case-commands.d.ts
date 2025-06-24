import { CommandInteraction, ButtonInteraction, ModalSubmitInteraction, User } from 'discord.js';
export declare class CaseCommands {
    private caseService;
    private caseRepository;
    constructor();
    reviewCase(details: string, interaction: CommandInteraction): Promise<void>;
    assignCase(lawyer: User, interaction: CommandInteraction): Promise<void>;
    closeCase(result: string, notes: string | undefined, interaction: CommandInteraction): Promise<void>;
    listCases(status: string | undefined, lawyer: User | undefined, search: string | undefined, page: number | undefined, interaction: CommandInteraction): Promise<void>;
    caseInfo(caseNumber: string | undefined, interaction: CommandInteraction): Promise<void>;
    private showCaseInfoTab;
    private buildOverviewTab;
    private buildDocumentsTab;
    private buildNotesTab;
    private buildTimelineTab;
    handleTabNavigation(interaction: ButtonInteraction): Promise<void>;
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
}
//# sourceMappingURL=case-commands.d.ts.map