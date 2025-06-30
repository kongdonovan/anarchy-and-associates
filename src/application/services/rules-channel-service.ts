import { Client, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { RulesChannel, Rule } from '../../validation';
import { RulesChannelRepository } from '../../infrastructure/repositories/rules-channel-repository';
import { logger } from '../../infrastructure/logger';

export interface UpdateRulesChannelRequest {
  guildId: string;
  channelId: string;
  title: string;
  content: string;
  rules?: Rule[];
  color?: number;
  thumbnailUrl?: string;
  imageUrl?: string;
  footer?: string;
  showNumbers?: boolean;
  additionalFields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  updatedBy: string;
}

export class RulesChannelService {
  constructor(
    private readonly rulesChannelRepository: RulesChannelRepository,
    private readonly discordClient: Client
  ) {}

  /**
   * Generates default rules template for different contexts
   */
  static generateDefaultRules(context: 'anarchy' | 'general' = 'general'): Partial<UpdateRulesChannelRequest> {
    if (context === 'anarchy') {
      return {
        title: '⚖️ Code of Professional Conduct | Anarchy & Associates',
        content: 'These bylaws govern all conduct within the Anarchy & Associates professional community. Adherence to these regulations is mandatory for all members, staff, and clients.',
        rules: [
          {
            id: 'rule_1',
            title: 'Professional Decorum & Mutual Respect',
            content: 'All members shall conduct themselves with the utmost professionalism and courtesy. Harassment, discrimination, defamation, or conduct unbecoming of a legal professional shall result in immediate disciplinary action, up to and including permanent disbarment from the firm.',
            category: 'conduct',
            severity: 'critical',
            order: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
          },
          {
            id: 'rule_2',
            title: 'Ethical Standards & Professional Integrity',
            content: 'Members must maintain the highest ethical standards befitting the legal profession. This encompasses honest communication, good faith negotiations, and adherence to professional boundaries in all interactions.',
            category: 'conduct',
            severity: 'critical',
            order: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
          },
          {
            id: 'rule_3',
            title: 'Attorney-Client Privilege & Confidentiality',
            content: 'The sanctity of attorney-client privilege is paramount. All case information, client communications, and sensitive materials are strictly confidential. Unauthorized disclosure of privileged information constitutes grounds for immediate termination and potential legal action.',
            category: 'general',
            severity: 'critical',
            order: 3,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
          },
          {
            id: 'rule_4',
            title: 'Proper Channel Utilization',
            content: 'Communications must be directed to appropriate channels. Client consultations shall occur in designated client channels, internal discussions in staff channels, and public discourse in community areas. Misuse of channels disrupts firm operations.',
            category: 'general',
            severity: 'high',
            order: 4,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
          },
          {
            id: 'rule_5',
            title: 'Prohibition of Solicitation & Spam',
            content: 'Unsolicited advertising, spam communications, or unauthorized solicitation of services is strictly prohibited. All business development activities must be approved by the Managing Partner.',
            category: 'conduct',
            severity: 'medium',
            order: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
          },
          {
            id: 'rule_6',
            title: 'Platform Compliance',
            content: 'All Discord Terms of Service and Community Guidelines remain in full effect. Violations thereof shall be reported to appropriate authorities and may result in firm disciplinary measures.',
            category: 'general',
            severity: 'high',
            order: 6,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
          },
          {
            id: 'rule_7',
            title: 'Compliance with Firm Directives',
            content: 'All lawful directives from Partners, Senior Associates, and authorized staff must be followed. Grievances should be addressed through proper channels with professional decorum.',
            category: 'general',
            severity: 'high',
            order: 7,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
          },
          {
            id: 'rule_8',
            title: 'Conflict of Interest Disclosure',
            content: 'Any potential conflicts of interest must be immediately disclosed to the Managing Partner. Failure to disclose conflicts may result in disciplinary action and case reassignment.',
            category: 'general',
            severity: 'critical',
            order: 8,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
          }
        ],
        color: 0x000000, // Professional black
        footer: '§ Violations are subject to disciplinary review by the Partnership Committee',
        showNumbers: true,
        additionalFields: [
          {
            name: '⚖️ Disciplinary Appeals Process',
            value: 'Members subject to disciplinary action may file a formal appeal with the Senior Partnership within 72 hours. Appeals must be submitted in writing with supporting documentation.',
            inline: false
          },
          {
            name: '§ Amendments & Inquiries',
            value: 'These regulations may be amended by majority vote of the Partnership. Direct inquiries regarding interpretation or application to the Managing Partner\'s office.',
            inline: false
          },
          {
            name: '📄 Effective Date',
            value: 'These bylaws are effective immediately and supersede all previous versions.',
            inline: false
          }
        ]
      };
    }

    // General template
    return {
      title: '§ Community Guidelines',
      content: 'These guidelines ensure a professional and respectful environment for all members.',
      rules: [
        {
          id: 'rule_1',
          title: 'Professional Courtesy',
          content: 'Maintain respectful discourse at all times. Harassment, discriminatory language, or personal attacks are grounds for immediate removal.',
          category: 'conduct',
          severity: 'critical',
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        },
        {
          id: 'rule_2',
          title: 'Communication Standards',
          content: 'Avoid excessive messaging, repetitive content, or disruptive behavior that impedes productive discussion.',
          category: 'conduct',
          severity: 'medium',
          order: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        },
        {
          id: 'rule_3',
          title: 'Content Appropriateness',
          content: 'All content must be suitable for a professional environment. Inappropriate material will be removed and may result in sanctions.',
          category: 'general',
          severity: 'high',
          order: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        },
        {
          id: 'rule_4',
          title: 'Channel Organization',
          content: 'Utilize designated channels for their intended purposes to maintain organizational efficiency.',
          category: 'general',
          severity: 'low',
          order: 4,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        },
        {
          id: 'rule_5',
          title: 'Terms of Service Compliance',
          content: 'Full compliance with Discord Terms of Service and Community Guidelines is mandatory.',
          category: 'general',
          severity: 'critical',
          order: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        }
      ],
      color: 0x36393F, // Professional charcoal
      footer: 'Violations subject to administrative review and appropriate sanctions',
      showNumbers: true
    };
  }

  async updateRulesChannel(request: UpdateRulesChannelRequest): Promise<RulesChannel> {
    const { guildId, channelId, updatedBy, ...rulesData } = request;

    // Get the Discord channel
    const guild = await this.discordClient.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    
    if (!channel || channel.type !== 0) {
      throw new Error('Channel not found or is not a text channel');
    }
    
    const textChannel = channel as TextChannel;

    // Check if we have an existing configuration
    const existing = await this.rulesChannelRepository.findByChannelId(guildId, channelId);
    
    // Create or update the embed
    const embed = this.createRulesEmbed(rulesData);
    
    let messageId: string;
    
    if (existing?.messageId) {
      // Try to update existing message
      try {
        const message = await textChannel.messages.fetch(existing.messageId);
        await message.edit({ embeds: [embed] });
        messageId = message.id;
      } catch (error) {
        // Message not found, create new one
        logger.warn('Rules message not found, creating new one', { 
          guildId, 
          channelId, 
          messageId: existing.messageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        const newMessage = await this.createNewRulesMessage(textChannel, embed);
        messageId = newMessage.id;
      }
    } else {
      // Create new message
      const newMessage = await this.createNewRulesMessage(textChannel, embed);
      messageId = newMessage.id;
    }

    // Save to database
    const rulesChannel = await this.rulesChannelRepository.upsertByChannelId(
      guildId,
      channelId,
      {
        ...rulesData,
        messageId,
        lastUpdatedBy: updatedBy
      }
    );

    logger.info('Rules channel updated', {
      guildId,
      channelId,
      messageId,
      updatedBy
    });

    return rulesChannel;
  }

  async getRulesChannel(guildId: string, channelId: string): Promise<RulesChannel | null> {
    return this.rulesChannelRepository.findByChannelId(guildId, channelId);
  }

  async listRulesChannels(guildId: string): Promise<RulesChannel[]> {
    return this.rulesChannelRepository.findByGuildId(guildId);
  }

  async deleteRulesChannel(guildId: string, channelId: string): Promise<boolean> {
    const existing = await this.rulesChannelRepository.findByChannelId(guildId, channelId);
    
    if (!existing) {
      return false;
    }

    // Try to delete the Discord message
    if (existing.messageId) {
      try {
        const guild = await this.discordClient.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(channelId);
        
        if (channel && channel.type === 0) {
          const message = await channel.messages.fetch(existing.messageId);
          await message.delete();
        }
      } catch (error) {
        logger.warn('Failed to delete rules message', {
          guildId,
          channelId,
          messageId: existing.messageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Delete from database
    const result = await this.rulesChannelRepository.delete(existing._id!.toString());
    
    logger.info('Rules channel deleted', {
      guildId,
      channelId,
      deleted: result
    });

    return result;
  }

  async syncRulesMessage(guildId: string, channelId: string): Promise<boolean> {
    const rules = await this.rulesChannelRepository.findByChannelId(guildId, channelId);
    
    if (!rules) {
      return false;
    }

    try {
      const guild = await this.discordClient.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      
      if (!channel || channel.type !== 0) {
        throw new Error('Channel not found or is not a text channel');
      }
      
      const textChannel = channel as TextChannel;

      const embed = this.createRulesEmbed(rules);
      
      if (rules.messageId) {
        // Try to find and update existing message
        try {
          const message = await textChannel.messages.fetch(rules.messageId);
          await message.edit({ embeds: [embed] });
          return true;
        } catch {
          // Message not found, create new one
          const newMessage = await this.createNewRulesMessage(textChannel, embed);
          await this.rulesChannelRepository.update(rules._id!.toString(), { messageId: newMessage.id });
          return true;
        }
      } else {
        // No message ID stored, create new message
        const newMessage = await this.createNewRulesMessage(textChannel, embed);
        await this.rulesChannelRepository.update(rules._id!.toString(), { messageId: newMessage.id });
        return true;
      }
    } catch (error) {
      logger.error('Failed to sync rules message', {
        guildId,
        channelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async addRule(
    guildId: string,
    channelId: string,
    rule: Omit<Rule, 'id' | 'order'>,
    updatedBy: string
  ): Promise<RulesChannel | null> {
    const result = await this.rulesChannelRepository.addRule(guildId, channelId, rule);
    
    if (result) {
      await this.rulesChannelRepository.update(result._id!.toString(), { lastUpdatedBy: updatedBy });
      await this.syncRulesMessage(guildId, channelId);
    }
    
    return result;
  }

  async removeRule(
    guildId: string,
    channelId: string,
    ruleId: string,
    updatedBy: string
  ): Promise<RulesChannel | null> {
    const result = await this.rulesChannelRepository.removeRule(guildId, channelId, ruleId);
    
    if (result) {
      await this.rulesChannelRepository.update(result._id!.toString(), { lastUpdatedBy: updatedBy });
      await this.syncRulesMessage(guildId, channelId);
    }
    
    return result;
  }

  private createRulesEmbed(data: Omit<UpdateRulesChannelRequest, 'guildId' | 'channelId' | 'updatedBy'> | RulesChannel): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(data.title ?? 'Rules')
      .setDescription(data.content ?? '')
      .setColor(data.color || 0x000000) // Default to professional black
      .setTimestamp();

    if (data.thumbnailUrl) {
      embed.setThumbnail(data.thumbnailUrl);
    }

    if (data.imageUrl) {
      embed.setImage(data.imageUrl);
    }

    if (data.footer) {
      embed.setFooter({ 
        text: data.footer,
        iconURL: 'https://cdn.discordapp.com/attachments/placeholder/scales-of-justice.png'
      });
    }

    // Add rules as fields or in description
    if (data.rules && data.rules.length > 0) {
      const sortedRules = [...data.rules].sort((a, b) => a.order - b.order);
      
      // Group rules by category if they have categories
      const categories = new Map<string, Rule[]>();
      const uncategorized: Rule[] = [];
      
      for (const rule of sortedRules) {
        if (rule.category) {
          const categoryRules = categories.get(rule.category) || [];
          categoryRules.push(rule);
          categories.set(rule.category, categoryRules);
        } else {
          uncategorized.push(rule);
        }
      }

      // Add categorized rules
      for (const [category, categoryRules] of categories) {
        const rulesText = categoryRules.map(rule => {
          const number = data.showNumbers !== false ? `**Article ${rule.order}** - ` : '';
          const severityBadge = rule.severity ? 
            (rule.severity === 'critical' ? ' ⚠️' : 
             rule.severity === 'high' ? ' ⚡' : 
             rule.severity === 'medium' ? ' •' : '') : '';
          return `${number}**${rule.title}**${severityBadge}\n> ${rule.content}`;
        }).join('\n\n');

        embed.addFields({
          name: `§ ${category}`,
          value: rulesText.substring(0, 1024), // Discord field limit
          inline: false
        });
      }

      // Add uncategorized rules
      if (uncategorized.length > 0) {
        const rulesText = uncategorized.map(rule => {
          const number = data.showNumbers !== false ? `**Article ${rule.order}** - ` : '';
          const severityBadge = rule.severity ? 
            (rule.severity === 'critical' ? ' ⚠️' : 
             rule.severity === 'high' ? ' ⚡' : 
             rule.severity === 'medium' ? ' •' : '') : '';
          return `${number}**${rule.title}**${severityBadge}\n> ${rule.content}`;
        }).join('\n\n');

        embed.addFields({
          name: '§ General Provisions',
          value: rulesText.substring(0, 1024),
          inline: false
        });
      }
    }

    // Add additional fields
    if (data.additionalFields && data.additionalFields.length > 0) {
      embed.addFields(data.additionalFields);
    }

    return embed;
  }

  private async createNewRulesMessage(channel: TextChannel, embed: EmbedBuilder): Promise<Message> {
    // Delete any old bot messages in the channel first (optional cleanup)
    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      const botMessages = messages.filter(msg => msg.author.id === this.discordClient.user?.id);
      
      if (botMessages.size > 0) {
        await channel.bulkDelete(botMessages);
      }
    } catch (error) {
      logger.warn('Failed to cleanup old bot messages', {
        channelId: channel.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Send new message
    return await channel.send({ embeds: [embed] });
  }
}