import { CommandInteraction, ButtonInteraction, ModalSubmitInteraction, User } from 'discord.js';
export declare class RetainerCommands {
    private retainerService;
    constructor();
    signRetainer(client: User, interaction: CommandInteraction): Promise<void>;
    listRetainers(interaction: CommandInteraction): Promise<void>;
    private sendRetainerDM;
    handleRetainerSign(interaction: ButtonInteraction): Promise<void>;
    handleRetainerSignature(interaction: ModalSubmitInteraction): Promise<void>;
    private handleRetainerCompletion;
    private assignClientRole;
    private archiveRetainerAgreement;
}
//# sourceMappingURL=retainer-commands.d.ts.map