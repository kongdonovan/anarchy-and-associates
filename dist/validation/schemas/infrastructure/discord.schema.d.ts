/**
 * @module DiscordSchemas
 * @description Zod schemas for Discord.js interactions and data structures
 * @category Infrastructure/Validation
 */
import { z } from 'zod';
/**
 * Discord user schema
 * @description Validates Discord user objects
 */
export declare const DiscordUserSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    discriminator: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
    avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    bot: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    username: string;
    discriminator: string;
    displayName?: string | undefined;
    avatar?: string | null | undefined;
    bot?: boolean | undefined;
}, {
    id: string;
    username: string;
    discriminator: string;
    displayName?: string | undefined;
    avatar?: string | null | undefined;
    bot?: boolean | undefined;
}>;
export type DiscordUser = z.infer<typeof DiscordUserSchema>;
/**
 * Discord guild member schema
 * @description Validates Discord guild member objects
 */
export declare const DiscordGuildMemberSchema: z.ZodObject<{
    user: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }>>;
    nick: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    roles: z.ZodArray<z.ZodString, "many">;
    joinedAt: z.ZodNullable<z.ZodString>;
    premiumSince: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    roles: string[];
    joinedAt: string | null;
    user?: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    } | undefined;
    nick?: string | null | undefined;
    premiumSince?: string | null | undefined;
}, {
    roles: string[];
    joinedAt: string | null;
    user?: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    } | undefined;
    nick?: string | null | undefined;
    premiumSince?: string | null | undefined;
}>;
export type DiscordGuildMember = z.infer<typeof DiscordGuildMemberSchema>;
/**
 * Discord interaction schema
 * @description Base validation for Discord interactions
 */
export declare const DiscordInteractionBaseSchema: z.ZodObject<{
    id: z.ZodString;
    applicationId: z.ZodString;
    guildId: z.ZodNullable<z.ZodString>;
    channelId: z.ZodNullable<z.ZodString>;
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }>;
    member: z.ZodOptional<z.ZodObject<{
        user: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            discriminator: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
            avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            bot: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        }, {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        }>>;
        nick: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        roles: z.ZodArray<z.ZodString, "many">;
        joinedAt: z.ZodNullable<z.ZodString>;
        premiumSince: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        roles: string[];
        joinedAt: string | null;
        user?: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        } | undefined;
        nick?: string | null | undefined;
        premiumSince?: string | null | undefined;
    }, {
        roles: string[];
        joinedAt: string | null;
        user?: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        } | undefined;
        nick?: string | null | undefined;
        premiumSince?: string | null | undefined;
    }>>;
    token: z.ZodString;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    guildId: string | null;
    id: string;
    token: string;
    channelId: string | null;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    version: number;
    applicationId: string;
    member?: {
        roles: string[];
        joinedAt: string | null;
        user?: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        } | undefined;
        nick?: string | null | undefined;
        premiumSince?: string | null | undefined;
    } | undefined;
}, {
    guildId: string | null;
    id: string;
    token: string;
    channelId: string | null;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    version: number;
    applicationId: string;
    member?: {
        roles: string[];
        joinedAt: string | null;
        user?: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        } | undefined;
        nick?: string | null | undefined;
        premiumSince?: string | null | undefined;
    } | undefined;
}>;
export type DiscordInteractionBase = z.infer<typeof DiscordInteractionBaseSchema>;
/**
 * Command interaction validation schema
 * @description Validates Discord slash command interactions
 */
export declare const CommandInteractionSchema: z.ZodObject<{
    guildId: z.ZodString;
    channelId: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        displayName?: string | undefined;
    }, {
        id: string;
        username: string;
        displayName?: string | undefined;
    }>;
    member: z.ZodOptional<z.ZodObject<{
        roles: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        roles: string[];
    }, {
        roles: string[];
    }>>;
    guild: z.ZodAny;
    replied: z.ZodOptional<z.ZodBoolean>;
    deferred: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    channelId: string;
    user: {
        id: string;
        username: string;
        displayName?: string | undefined;
    };
    guild?: any;
    member?: {
        roles: string[];
    } | undefined;
    replied?: boolean | undefined;
    deferred?: boolean | undefined;
}, {
    guildId: string;
    channelId: string;
    user: {
        id: string;
        username: string;
        displayName?: string | undefined;
    };
    guild?: any;
    member?: {
        roles: string[];
    } | undefined;
    replied?: boolean | undefined;
    deferred?: boolean | undefined;
}>;
export type CommandInteraction = z.infer<typeof CommandInteractionSchema>;
/**
 * Button interaction validation schema
 * @description Validates Discord button interactions
 */
export declare const ButtonInteractionSchema: z.ZodObject<{
    customId: z.ZodString;
    guildId: z.ZodNullable<z.ZodString>;
    channelId: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }>;
    message: z.ZodAny;
}, "strip", z.ZodTypeAny, {
    guildId: string | null;
    channelId: string;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    customId: string;
    message?: any;
}, {
    guildId: string | null;
    channelId: string;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    customId: string;
    message?: any;
}>;
export type ButtonInteraction = z.infer<typeof ButtonInteractionSchema>;
/**
 * Select menu interaction validation schema
 * @description Validates Discord select menu interactions
 */
export declare const SelectMenuInteractionSchema: z.ZodObject<{
    customId: z.ZodString;
    values: z.ZodArray<z.ZodString, "many">;
    guildId: z.ZodNullable<z.ZodString>;
    channelId: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    guildId: string | null;
    values: string[];
    channelId: string;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    customId: string;
}, {
    guildId: string | null;
    values: string[];
    channelId: string;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    customId: string;
}>;
export type SelectMenuInteraction = z.infer<typeof SelectMenuInteractionSchema>;
/**
 * Modal submit interaction validation schema
 * @description Validates Discord modal submissions
 */
export declare const ModalSubmitInteractionSchema: z.ZodObject<{
    customId: z.ZodString;
    fields: z.ZodAny;
    guildId: z.ZodNullable<z.ZodString>;
    channelId: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    guildId: string | null;
    channelId: string;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    customId: string;
    fields?: any;
}, {
    guildId: string | null;
    channelId: string;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    customId: string;
    fields?: any;
}>;
export type ModalSubmitInteraction = z.infer<typeof ModalSubmitInteractionSchema>;
/**
 * Discord embed field schema
 * @description Validates embed field structure
 */
export declare const DiscordEmbedFieldSchema: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
    inline: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    value: string;
    inline?: boolean | undefined;
}, {
    name: string;
    value: string;
    inline?: boolean | undefined;
}>;
export type DiscordEmbedField = z.infer<typeof DiscordEmbedFieldSchema>;
/**
 * Discord embed schema
 * @description Validates Discord embed structure
 */
export declare const DiscordEmbedSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodNumber>;
    timestamp: z.ZodOptional<z.ZodString>;
    fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
        inline: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        value: string;
        inline?: boolean | undefined;
    }, {
        name: string;
        value: string;
        inline?: boolean | undefined;
    }>, "many">>;
    thumbnail: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
    }, {
        url: string;
    }>>;
    image: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
    }, {
        url: string;
    }>>;
    author: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
        iconURL: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url?: string | undefined;
        iconURL?: string | undefined;
    }, {
        name: string;
        url?: string | undefined;
        iconURL?: string | undefined;
    }>>;
    footer: z.ZodOptional<z.ZodObject<{
        text: z.ZodString;
        iconURL: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        iconURL?: string | undefined;
    }, {
        text: string;
        iconURL?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    timestamp?: string | undefined;
    url?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    color?: number | undefined;
    footer?: {
        text: string;
        iconURL?: string | undefined;
    } | undefined;
    fields?: {
        name: string;
        value: string;
        inline?: boolean | undefined;
    }[] | undefined;
    thumbnail?: {
        url: string;
    } | undefined;
    image?: {
        url: string;
    } | undefined;
    author?: {
        name: string;
        url?: string | undefined;
        iconURL?: string | undefined;
    } | undefined;
}, {
    timestamp?: string | undefined;
    url?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    color?: number | undefined;
    footer?: {
        text: string;
        iconURL?: string | undefined;
    } | undefined;
    fields?: {
        name: string;
        value: string;
        inline?: boolean | undefined;
    }[] | undefined;
    thumbnail?: {
        url: string;
    } | undefined;
    image?: {
        url: string;
    } | undefined;
    author?: {
        name: string;
        url?: string | undefined;
        iconURL?: string | undefined;
    } | undefined;
}>;
export type DiscordEmbed = z.infer<typeof DiscordEmbedSchema>;
/**
 * Validate total embed size
 * @description Ensures embed doesn't exceed Discord's 6000 character limit
 */
export declare const validateEmbedSize: (embed: DiscordEmbed) => boolean;
//# sourceMappingURL=discord.schema.d.ts.map