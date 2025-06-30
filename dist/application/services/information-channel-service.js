"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InformationChannelService = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../infrastructure/logger");
class InformationChannelService {
    constructor(informationChannelRepository, discordClient) {
        this.informationChannelRepository = informationChannelRepository;
        this.discordClient = discordClient;
    }
    /**
     * Generates a default information message template
     */
    static generateDefaultTemplate(guildName, context = 'general') {
        if (context === 'welcome') {
            return {
                title: '⚖️ Welcome to Anarchy & Associates',
                content: `Distinguished colleagues and esteemed clients,

We extend our warmest welcome to **Anarchy & Associates**, a premier full-service law firm dedicated to providing exceptional legal representation and counsel.

**§ Our Commitment**
Our firm stands as a pillar of legal excellence, offering sophisticated solutions to complex legal matters with unwavering integrity, meticulous attention to detail, and zealous advocacy for our clients' interests.

**§ Practice Areas**
• Corporate Law & Business Formation
• Contract Negotiation & Documentation
• Dispute Resolution & Arbitration
• Litigation Support & Trial Advocacy
• Regulatory Compliance & Advisory

**§ Engagement Process**
1. Review our Terms of Service and Community Guidelines
2. Submit inquiries through designated channels
3. Consult with our legal professionals via appointment

**§ Client Services**
To initiate a new matter, please utilize \`/case create\` to open a formal case file with our firm.

**§ Office Hours**
Our attorneys and support staff are available to address your legal needs during regular business hours. For urgent matters, please contact the managing partner directly.

*Attorney-Client Privilege Notice: Communications within this server may be subject to confidentiality protections.*`,
                color: 0x000000, // Professional black
                footer: '© Anarchy & Associates | Attorney Advertising | Prior Results Do Not Guarantee Similar Outcomes'
            };
        }
        // General template
        return {
            title: '📋 Firm Information',
            content: `Welcome to **${guildName}**

This memorandum contains essential information regarding our legal practice and professional community.

**§ Quick Reference**
• Utilize designated command channels for firm services
• Review category-specific channels for specialized matters
• Contact senior associates for administrative assistance

**§ Professional Conduct**
All members are expected to maintain the highest standards of professional decorum and ethical conduct in accordance with our firm's policies.

*This communication is automatically generated. Authorized personnel may customize this notice using \`/info set\`.*`,
            color: 0x36393F, // Professional charcoal
            footer: 'This communication is confidential and may be legally privileged'
        };
    }
    async updateInformationChannel(request) {
        const { guildId, channelId, updatedBy, ...embedData } = request;
        // Get the Discord channel
        const guild = await this.discordClient.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(channelId);
        if (!channel || channel.type !== 0) {
            throw new Error('Channel not found or is not a text channel');
        }
        const textChannel = channel;
        // Check if we have an existing configuration
        const existing = await this.informationChannelRepository.findByChannelId(guildId, channelId);
        // Create or update the embed
        const embed = this.createInformationEmbed(embedData);
        let messageId;
        if (existing?.messageId) {
            // Try to update existing message
            try {
                const message = await textChannel.messages.fetch(existing.messageId);
                await message.edit({ embeds: [embed] });
                messageId = message.id;
            }
            catch (error) {
                // Message not found, create new one
                logger_1.logger.warn('Information message not found, creating new one', {
                    guildId,
                    channelId,
                    messageId: existing.messageId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                const newMessage = await this.createNewInformationMessage(textChannel, embed);
                messageId = newMessage.id;
            }
        }
        else {
            // Create new message
            const newMessage = await this.createNewInformationMessage(textChannel, embed);
            messageId = newMessage.id;
        }
        // Save to database
        const informationChannel = await this.informationChannelRepository.upsertByChannelId(guildId, channelId, {
            content: embedData.content,
            messageId,
            lastUpdatedBy: updatedBy
        });
        logger_1.logger.info('Information channel updated', {
            guildId,
            channelId,
            messageId,
            updatedBy
        });
        return informationChannel;
    }
    async getInformationChannel(guildId, channelId) {
        return this.informationChannelRepository.findByChannelId(guildId, channelId);
    }
    async listInformationChannels(guildId) {
        return this.informationChannelRepository.findByGuildId(guildId);
    }
    async deleteInformationChannel(guildId, channelId) {
        const existing = await this.informationChannelRepository.findByChannelId(guildId, channelId);
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
            }
            catch (error) {
                logger_1.logger.warn('Failed to delete information message', {
                    guildId,
                    channelId,
                    messageId: existing.messageId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        // Delete from database
        const result = await this.informationChannelRepository.delete(existing._id.toString());
        logger_1.logger.info('Information channel deleted', {
            guildId,
            channelId,
            deleted: result
        });
        return result;
    }
    async syncInformationMessage(guildId, channelId) {
        const info = await this.informationChannelRepository.findByChannelId(guildId, channelId);
        if (!info) {
            return false;
        }
        try {
            const guild = await this.discordClient.guilds.fetch(guildId);
            const channel = await guild.channels.fetch(channelId);
            if (!channel || channel.type !== 0) {
                throw new Error('Channel not found or is not a text channel');
            }
            const textChannel = channel;
            const embed = this.createInformationEmbed({
                title: 'Information',
                content: info.content
            });
            if (info.messageId) {
                // Try to find and update existing message
                try {
                    const message = await textChannel.messages.fetch(info.messageId);
                    await message.edit({ embeds: [embed] });
                    return true;
                }
                catch {
                    // Message not found, create new one
                    const newMessage = await this.createNewInformationMessage(textChannel, embed);
                    await this.informationChannelRepository.update(info._id.toString(), { messageId: newMessage.id });
                    return true;
                }
            }
            else {
                // No message ID stored, create new message
                const newMessage = await this.createNewInformationMessage(textChannel, embed);
                await this.informationChannelRepository.update(info._id.toString(), { messageId: newMessage.id });
                return true;
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to sync information message', {
                guildId,
                channelId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    createInformationEmbed(data) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(data.title)
            .setDescription(data.content)
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
        if (data.fields && data.fields.length > 0) {
            embed.addFields(data.fields);
        }
        return embed;
    }
    async createNewInformationMessage(channel, embed) {
        // Delete any old bot messages in the channel first (optional cleanup)
        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const botMessages = messages.filter(msg => msg.author.id === this.discordClient.user?.id);
            if (botMessages.size > 0) {
                await channel.bulkDelete(botMessages);
            }
        }
        catch (error) {
            logger_1.logger.warn('Failed to cleanup old bot messages', {
                channelId: channel.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        // Send new message
        return await channel.send({ embeds: [embed] });
    }
}
exports.InformationChannelService = InformationChannelService;
//# sourceMappingURL=information-channel-service.js.map