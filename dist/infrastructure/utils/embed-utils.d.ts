import { EmbedBuilder, APIEmbedField } from 'discord.js';
export declare class EmbedUtils {
    private static readonly BRAND_COLOR;
    private static readonly ACCENT_COLOR;
    private static readonly SECONDARY_COLOR;
    private static readonly SUCCESS_COLOR;
    private static readonly ERROR_COLOR;
    private static readonly WARNING_COLOR;
    private static readonly INFO_COLOR;
    private static readonly ICONS;
    static createAALegalEmbed(options?: {
        title?: string;
        description?: string;
        color?: 'brand' | 'accent' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
        timestamp?: boolean;
        footer?: string;
        author?: {
            name: string;
            iconURL?: string;
        };
        thumbnail?: string;
        fields?: APIEmbedField[];
    }): EmbedBuilder;
    static createSuccessEmbed(title: string, description?: string, fields?: APIEmbedField[]): EmbedBuilder;
    static createErrorEmbed(title: string, description?: string, fields?: APIEmbedField[]): EmbedBuilder;
    static createWarningEmbed(title: string, description?: string, fields?: APIEmbedField[]): EmbedBuilder;
    static createInfoEmbed(title: string, description?: string, fields?: APIEmbedField[]): EmbedBuilder;
    static createCaseEmbed(options: {
        title: string;
        caseNumber?: string;
        description?: string;
        status?: 'open' | 'closed' | 'review';
        fields?: APIEmbedField[];
    }): EmbedBuilder;
    static createStaffEmbed(options: {
        title: string;
        description?: string;
        staffMember?: string;
        role?: string;
        action?: 'hire' | 'promote' | 'terminate' | 'update';
        fields?: APIEmbedField[];
    }): EmbedBuilder;
    static createDocumentEmbed(options: {
        title: string;
        documentType: 'contract' | 'retainer' | 'application' | 'feedback' | 'report';
        description?: string;
        fields?: APIEmbedField[];
    }): EmbedBuilder;
    static addFieldSafe(embed: EmbedBuilder, name: string, value: string, inline?: boolean): EmbedBuilder;
    static setDescriptionSafe(embed: EmbedBuilder, description: string): EmbedBuilder;
    static formatSignature(name: string, title: string): string;
    static getLegalFooter(): string;
    static formatList(items: string[], numbered?: boolean): string;
}
//# sourceMappingURL=embed-utils.d.ts.map