/**
 * @module DiscordSchemas
 * @description Zod schemas for Discord.js interactions and data structures
 * @category Infrastructure/Validation
 */

import { z } from 'zod';
import { DiscordSnowflakeSchema } from '../shared';

/**
 * Discord user schema
 * @description Validates Discord user objects
 */
export const DiscordUserSchema = z.object({
  id: DiscordSnowflakeSchema,
  username: z.string().min(1).max(32),
  discriminator: z.string().regex(/^\d{4}$/),
  displayName: z.string().optional(),
  avatar: z.string().nullable().optional(),
  bot: z.boolean().optional(),
});

export type DiscordUser = z.infer<typeof DiscordUserSchema>;

/**
 * Discord guild member schema
 * @description Validates Discord guild member objects
 */
export const DiscordGuildMemberSchema = z.object({
  user: DiscordUserSchema.optional(),
  nick: z.string().nullable().optional(),
  roles: z.array(DiscordSnowflakeSchema),
  joinedAt: z.string().nullable(),
  premiumSince: z.string().nullable().optional(),
});

export type DiscordGuildMember = z.infer<typeof DiscordGuildMemberSchema>;

/**
 * Discord interaction schema
 * @description Base validation for Discord interactions
 */
export const DiscordInteractionBaseSchema = z.object({
  id: DiscordSnowflakeSchema,
  applicationId: DiscordSnowflakeSchema,
  guildId: DiscordSnowflakeSchema.nullable(),
  channelId: DiscordSnowflakeSchema.nullable(),
  user: DiscordUserSchema,
  member: DiscordGuildMemberSchema.optional(),
  token: z.string(),
  version: z.number(),
});

export type DiscordInteractionBase = z.infer<typeof DiscordInteractionBaseSchema>;

/**
 * Command interaction validation schema
 * @description Validates Discord slash command interactions
 */
export const CommandInteractionSchema = z.object({
  guildId: DiscordSnowflakeSchema,
  channelId: DiscordSnowflakeSchema,
  user: z.object({
    id: DiscordSnowflakeSchema,
    username: z.string(),
    displayName: z.string().optional(),
  }),
  member: z.object({
    roles: z.array(DiscordSnowflakeSchema),
  }).optional(),
  guild: z.any(), // Discord.js Guild object
  replied: z.boolean().optional(),
  deferred: z.boolean().optional(),
});

export type CommandInteraction = z.infer<typeof CommandInteractionSchema>;

/**
 * Button interaction validation schema
 * @description Validates Discord button interactions
 */
export const ButtonInteractionSchema = z.object({
  customId: z.string(),
  guildId: DiscordSnowflakeSchema.nullable(),
  channelId: DiscordSnowflakeSchema,
  user: DiscordUserSchema,
  message: z.any(), // Discord.js Message object
});

export type ButtonInteraction = z.infer<typeof ButtonInteractionSchema>;

/**
 * Select menu interaction validation schema
 * @description Validates Discord select menu interactions
 */
export const SelectMenuInteractionSchema = z.object({
  customId: z.string(),
  values: z.array(z.string()),
  guildId: DiscordSnowflakeSchema.nullable(),
  channelId: DiscordSnowflakeSchema,
  user: DiscordUserSchema,
});

export type SelectMenuInteraction = z.infer<typeof SelectMenuInteractionSchema>;

/**
 * Modal submit interaction validation schema
 * @description Validates Discord modal submissions
 */
export const ModalSubmitInteractionSchema = z.object({
  customId: z.string(),
  fields: z.any(), // ModalSubmitFieldsResolver
  guildId: DiscordSnowflakeSchema.nullable(),
  channelId: DiscordSnowflakeSchema,
  user: DiscordUserSchema,
});

export type ModalSubmitInteraction = z.infer<typeof ModalSubmitInteractionSchema>;

/**
 * Discord embed field schema
 * @description Validates embed field structure
 */
export const DiscordEmbedFieldSchema = z.object({
  name: z.string().max(256),
  value: z.string().max(1024),
  inline: z.boolean().optional(),
});

export type DiscordEmbedField = z.infer<typeof DiscordEmbedFieldSchema>;

/**
 * Discord embed schema
 * @description Validates Discord embed structure
 */
export const DiscordEmbedSchema = z.object({
  title: z.string().max(256).optional(),
  description: z.string().max(4096).optional(),
  url: z.string().url().optional(),
  color: z.number().int().min(0).max(16777215).optional(),
  timestamp: z.string().datetime().optional(),
  fields: z.array(DiscordEmbedFieldSchema).max(25).optional(),
  thumbnail: z.object({
    url: z.string().url(),
  }).optional(),
  image: z.object({
    url: z.string().url(),
  }).optional(),
  author: z.object({
    name: z.string().max(256),
    url: z.string().url().optional(),
    iconURL: z.string().url().optional(),
  }).optional(),
  footer: z.object({
    text: z.string().max(2048),
    iconURL: z.string().url().optional(),
  }).optional(),
});

export type DiscordEmbed = z.infer<typeof DiscordEmbedSchema>;

/**
 * Validate total embed size
 * @description Ensures embed doesn't exceed Discord's 6000 character limit
 */
export const validateEmbedSize = (embed: DiscordEmbed): boolean => {
  let totalSize = 0;
  
  if (embed.title) totalSize += embed.title.length;
  if (embed.description) totalSize += embed.description.length;
  if (embed.fields) {
    embed.fields.forEach(field => {
      totalSize += field.name.length + field.value.length;
    });
  }
  if (embed.footer?.text) totalSize += embed.footer.text.length;
  if (embed.author?.name) totalSize += embed.author.name.length;
  
  return totalSize <= 6000;
};
