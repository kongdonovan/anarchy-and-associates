import { CommandInteraction } from 'discord.js';
export declare class ReminderCommands {
    private reminderService;
    constructor();
    setReminder(timeString: string, message: string, interaction: CommandInteraction): Promise<void>;
    listReminders(interaction: CommandInteraction): Promise<void>;
    cancelReminder(reminderId: string, interaction: CommandInteraction): Promise<void>;
    viewCaseReminders(interaction: CommandInteraction): Promise<void>;
}
//# sourceMappingURL=reminder-commands.d.ts.map