import { CommandInteraction, User } from 'discord.js';
export declare class FeedbackCommands {
    private feedbackService;
    constructor();
    submitFeedback(rating: number, comment: string, staff: User | undefined, interaction: CommandInteraction): Promise<void>;
    viewFeedback(staff: User | undefined, interaction: CommandInteraction): Promise<void>;
    private getRatingColor;
    private getProfessionalRatingColor;
}
//# sourceMappingURL=feedback-commands.d.ts.map