import { EmbedBuilder, ColorResolvable, APIEmbedField } from 'discord.js';

export class EmbedUtils {
  // Professional Law Firm Color Palette
  private static readonly BRAND_COLOR: ColorResolvable = 0x000000; // Pure Black - Primary brand color
  private static readonly ACCENT_COLOR: ColorResolvable = 0xD4AF37; // Deep Gold - Prestige and success
  private static readonly SECONDARY_COLOR: ColorResolvable = 0x36393F; // Charcoal - Professional dark theme
  private static readonly SUCCESS_COLOR: ColorResolvable = 0x2D7D46; // Deep Forest Green - Accomplished
  private static readonly ERROR_COLOR: ColorResolvable = 0xA62019; // Deep Crimson - Serious matters
  private static readonly WARNING_COLOR: ColorResolvable = 0xF0B232; // Amber - Attention required
  private static readonly INFO_COLOR: ColorResolvable = 0x1E3A5F; // Navy Blue - Trust and stability
  
  // Professional Icons
  private static readonly ICONS = {
    firm: '⚖️',
    success: '✓',
    error: '⚠',
    warning: '⚡',
    info: '📋',
    case: '📑',
    staff: '👔',
    client: '🤝',
    document: '📄',
    legal: '§'
  };

  public static createAALegalEmbed(options: {
    title?: string;
    description?: string;
    color?: 'brand' | 'accent' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
    timestamp?: boolean;
    footer?: string;
    author?: { name: string; iconURL?: string };
    thumbnail?: string;
    fields?: APIEmbedField[];
  } = {}): EmbedBuilder {
    const embed = new EmbedBuilder();

    // Set color based on type
    const colorMap = {
      brand: this.BRAND_COLOR,
      accent: this.ACCENT_COLOR,
      secondary: this.SECONDARY_COLOR,
      success: this.SUCCESS_COLOR,
      error: this.ERROR_COLOR,
      warning: this.WARNING_COLOR,
      info: this.INFO_COLOR
    };
    
    embed.setColor(colorMap[options.color || 'brand']);

    // Set author if provided
    if (options.author) {
      embed.setAuthor(options.author);
    }

    // Set title with professional formatting
    if (options.title) {
      embed.setTitle(options.title);
    }

    // Set description with professional language
    if (options.description) {
      embed.setDescription(options.description);
    }

    // Set thumbnail for branding
    if (options.thumbnail) {
      embed.setThumbnail(options.thumbnail);
    }

    // Add fields if provided
    if (options.fields && options.fields.length > 0) {
      embed.addFields(options.fields);
    }

    // Set footer with firm branding and legal disclaimer if needed
    const footerText = options.footer || '© Anarchy & Associates | Excellence in Legal Services';
    embed.setFooter({ 
      text: footerText,
      iconURL: 'https://cdn.discordapp.com/attachments/placeholder/scales-of-justice.png'
    });

    // Set timestamp for audit trail
    if (options.timestamp !== false) {
      embed.setTimestamp();
    }

    return embed;
  }

  public static createSuccessEmbed(title: string, description?: string, fields?: APIEmbedField[]): EmbedBuilder {
    return this.createAALegalEmbed({
      title: `${this.ICONS.success} ${title}`,
      description,
      color: 'success',
      fields
    });
  }

  public static createErrorEmbed(title: string, description?: string, fields?: APIEmbedField[]): EmbedBuilder {
    return this.createAALegalEmbed({
      title: `${this.ICONS.error} ${title}`,
      description,
      color: 'error',
      fields
    });
  }

  public static createWarningEmbed(title: string, description?: string, fields?: APIEmbedField[]): EmbedBuilder {
    return this.createAALegalEmbed({
      title: `${this.ICONS.warning} ${title}`,
      description,
      color: 'warning',
      fields
    });
  }

  public static createInfoEmbed(title: string, description?: string, fields?: APIEmbedField[]): EmbedBuilder {
    return this.createAALegalEmbed({
      title: `${this.ICONS.info} ${title}`,
      description,
      color: 'info',
      fields
    });
  }

  // Professional embed for case-related operations
  public static createCaseEmbed(options: {
    title: string;
    caseNumber?: string;
    description?: string;
    status?: 'open' | 'closed' | 'review';
    fields?: APIEmbedField[];
  }): EmbedBuilder {
    const statusColors = {
      open: 'accent',
      closed: 'secondary',
      review: 'warning'
    };

    return this.createAALegalEmbed({
      title: `${this.ICONS.case} ${options.title}`,
      description: options.description,
      color: statusColors[options.status || 'open'] as any,
      fields: [
        ...(options.caseNumber ? [{ name: 'Case Reference', value: `\`${options.caseNumber}\``, inline: true }] : []),
        ...(options.fields || [])
      ]
    });
  }

  // Professional embed for staff operations
  public static createStaffEmbed(options: {
    title: string;
    description?: string;
    staffMember?: string;
    role?: string;
    action?: 'hire' | 'promote' | 'terminate' | 'update';
    fields?: APIEmbedField[];
  }): EmbedBuilder {
    const actionColors = {
      hire: 'success',
      promote: 'accent',
      terminate: 'error',
      update: 'info'
    };

    return this.createAALegalEmbed({
      title: `${this.ICONS.staff} ${options.title}`,
      description: options.description,
      color: actionColors[options.action || 'update'] as any,
      fields: [
        ...(options.staffMember ? [{ name: 'Staff Member', value: options.staffMember, inline: true }] : []),
        ...(options.role ? [{ name: 'Position', value: options.role, inline: true }] : []),
        ...(options.fields || [])
      ]
    });
  }

  // Professional embed for legal documents and forms
  public static createDocumentEmbed(options: {
    title: string;
    documentType: 'contract' | 'retainer' | 'application' | 'feedback' | 'report';
    description?: string;
    fields?: APIEmbedField[];
  }): EmbedBuilder {
    const typeIcons = {
      contract: this.ICONS.legal,
      retainer: this.ICONS.document,
      application: this.ICONS.document,
      feedback: this.ICONS.client,
      report: this.ICONS.info
    };

    return this.createAALegalEmbed({
      title: `${typeIcons[options.documentType]} ${options.title}`,
      description: options.description,
      color: 'secondary',
      fields: options.fields
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

  // Format professional signatures for embeds
  public static formatSignature(name: string, title: string): string {
    return `*${name}*\n${title}\nAnarchy & Associates`;
  }

  // Format legal notice footer
  public static getLegalFooter(): string {
    return 'This communication is confidential and may be legally privileged';
  }

  // Create a professional list format
  public static formatList(items: string[], numbered = false): string {
    return items.map((item, index) => 
      numbered ? `${index + 1}. ${item}` : `• ${item}`
    ).join('\n');
  }
}