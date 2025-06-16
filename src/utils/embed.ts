/**
 * Embed utility for branded Anarchy & Associates embeds.
 * @module utils/embed
 */
import { EmbedBuilder, ColorResolvable, APIEmbedField } from "discord.js";

/**
 * Creates a branded, sophisticated embed for Anarchy & Associates.
 */
export function createAALegalEmbed({
  title,
  description,
  color = "#4B006E", // Deep purple
  fields,
  footer = "Anarchy & Associates — Legal Operations",
  thumbnail,
  timestamp = true,
}: {
  title: string;
  description?: string;
  color?: ColorResolvable;
  fields?: APIEmbedField[];
  footer?: string;
  thumbnail?: string;
  timestamp?: boolean;
}) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`⚖️ ${title}`)
    .setFooter({ text: footer });
  if (description) embed.setDescription(description);
  if (fields) embed.addFields(fields);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (timestamp) embed.setTimestamp();
  return embed;
}

/**
 * Creates an info embed.
 */
export function infoEmbed(title: string, description: string, color = 0x2b2d31) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: "Anarchy & Associates Bot" });
}

/**
 * Creates an error embed.
 */
export function errorEmbed(title: string, description: string) {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setColor(0xFF5555)
    .setTimestamp()
    .setFooter({ text: "Anarchy & Associates Bot" });
}

/**
 * Creates a success embed.
 */
export function successEmbed(title: string, description: string) {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setColor(0x57F287)
    .setTimestamp()
    .setFooter({ text: "Anarchy & Associates Bot" });
}
