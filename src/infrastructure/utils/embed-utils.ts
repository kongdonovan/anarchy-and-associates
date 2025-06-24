import { EmbedBuilder, ColorResolvable } from 'discord.js';

export class EmbedUtils {
  private static readonly BRAND_COLOR: ColorResolvable = 0x2B2D31; // Professional dark gray
  private static readonly SUCCESS_COLOR: ColorResolvable = 0x00FF41; // Bright green
  private static readonly ERROR_COLOR: ColorResolvable = 0xFF4136; // Red
  private static readonly WARNING_COLOR: ColorResolvable = 0xFF851B; // Orange
  private static readonly INFO_COLOR: ColorResolvable = 0x0074D9; // Blue

  public static createAALegalEmbed(options: {
    title?: string;
    description?: string;
    color?: 'brand' | 'success' | 'error' | 'warning' | 'info';
    timestamp?: boolean;
    footer?: string;
  } = {}): EmbedBuilder {
    const embed = new EmbedBuilder();

    // Set color based on type
    const colorMap = {
      brand: this.BRAND_COLOR,
      success: this.SUCCESS_COLOR,
      error: this.ERROR_COLOR,
      warning: this.WARNING_COLOR,
      info: this.INFO_COLOR
    };
    
    embed.setColor(colorMap[options.color || 'brand']);

    // Set title with firm branding
    if (options.title) {
      embed.setTitle(options.title);
    }

    // Set description
    if (options.description) {
      embed.setDescription(options.description);
    }

    // Set footer with firm branding
    const footerText = options.footer || 'Anarchy & Associates Legal Services';
    embed.setFooter({ 
      text: footerText,
      iconURL: 'https://cdn.discordapp.com/attachments/placeholder/logo.png' // Placeholder for firm logo
    });

    // Set timestamp if requested
    if (options.timestamp !== false) {
      embed.setTimestamp();
    }

    return embed;
  }

  public static createSuccessEmbed(title: string, description?: string): EmbedBuilder {
    return this.createAALegalEmbed({
      title: `✅ ${title}`,
      description,
      color: 'success'
    });
  }

  public static createErrorEmbed(title: string, description?: string): EmbedBuilder {
    return this.createAALegalEmbed({
      title: `❌ ${title}`,
      description,
      color: 'error'
    });
  }

  public static createWarningEmbed(title: string, description?: string): EmbedBuilder {
    return this.createAALegalEmbed({
      title: `⚠️ ${title}`,
      description,
      color: 'warning'
    });
  }

  public static createInfoEmbed(title: string, description?: string): EmbedBuilder {
    return this.createAALegalEmbed({
      title: `ℹ️ ${title}`,
      description,
      color: 'info'
    });
  }

  public static addFieldSafe(embed: EmbedBuilder, name: string, value: string, inline = false): EmbedBuilder {
    // Discord field value limit is 1024 characters
    const truncatedValue = value.length > 1024 ? value.substring(0, 1021) + '...' : value;
    return embed.addFields({ name, value: truncatedValue, inline });
  }

  public static setDescriptionSafe(embed: EmbedBuilder, description: string): EmbedBuilder {
    // Discord description limit is 4096 characters
    const truncatedDescription = description.length > 4096 ? description.substring(0, 4093) + '...' : description;
    return embed.setDescription(truncatedDescription);
  }
}