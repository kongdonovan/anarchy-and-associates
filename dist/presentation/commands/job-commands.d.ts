import { CommandInteraction, ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction } from 'discord.js';
import { BaseCommand } from './base-command';
import { StaffRole } from '../../validation';
export declare class JobsCommands extends BaseCommand {
    private jobService;
    private questionService;
    private cleanupService;
    private applicationService;
    private jobRepository;
    private guildConfigRepository;
    constructor();
    apply(interaction: CommandInteraction): Promise<void>;
    list(status: string, role: StaffRole, search: string, page: number, interaction: CommandInteraction): Promise<void>;
    add(title: string, description: string, role: StaffRole, discordRole: string, interaction: CommandInteraction): Promise<void>;
    edit(jobId: string, title: string, description: string, role: StaffRole, discordRole: string, status: string, interaction: CommandInteraction): Promise<void>;
    info(jobId: string, interaction: CommandInteraction): Promise<void>;
    close(jobId: string, interaction: CommandInteraction): Promise<void>;
    remove(jobId: string, interaction: CommandInteraction): Promise<void>;
    handleListPagination(interaction: ButtonInteraction): Promise<void>;
    questions(category: string, interaction: CommandInteraction): Promise<void>;
    question_preview(templateId: string, interaction: CommandInteraction): Promise<void>;
    add_questions(jobId: string, templateIds: string, forceRequired: boolean, interaction: CommandInteraction): Promise<void>;
    cleanup_roles(dryRun: boolean, interaction: CommandInteraction): Promise<void>;
    cleanup_report(interaction: CommandInteraction): Promise<void>;
    cleanup_expired(maxDays: number, dryRun: boolean, interaction: CommandInteraction): Promise<void>;
    handleJobSelection(interaction: StringSelectMenuInteraction): Promise<void>;
    handleApplicationSubmission(interaction: ModalSubmitInteraction): Promise<void>;
    private postApplicationForReview;
    handleApplicationAccept(interaction: ButtonInteraction): Promise<void>;
    handleApplicationDecline(interaction: ButtonInteraction): Promise<void>;
    handleDeclineReason(interaction: ModalSubmitInteraction): Promise<void>;
}
//# sourceMappingURL=job-commands.d.ts.map