import { EmbedBuilder } from 'discord.js';
export declare class EmbedUtils {
    private static readonly BRAND_COLOR;
    private static readonly SUCCESS_COLOR;
    private static readonly ERROR_COLOR;
    private static readonly WARNING_COLOR;
    private static readonly INFO_COLOR;
    static createAALegalEmbed(options?: {
        title?: string;
        description?: string;
        color?: 'brand' | 'success' | 'error' | 'warning' | 'info';
        timestamp?: boolean;
        footer?: string;
    }): EmbedBuilder;
    static createSuccessEmbed(title: string, description?: string): EmbedBuilder;
    static createErrorEmbed(title: string, description?: string): EmbedBuilder;
    static createWarningEmbed(title: string, description?: string): EmbedBuilder;
    static createInfoEmbed(title: string, description?: string): EmbedBuilder;
    static addFieldSafe(embed: EmbedBuilder, name: string, value: string, inline?: boolean): EmbedBuilder;
    static setDescriptionSafe(embed: EmbedBuilder, description: string): EmbedBuilder;
}
//# sourceMappingURL=embed-utils.d.ts.map