"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationErrorHandler = void 0;
const discord_js_1 = require("discord.js");
const embed_utils_1 = require("../../infrastructure/utils/embed-utils");
const role_utils_1 = require("../../infrastructure/utils/role-utils");
class ValidationErrorHandler {
    /**
     * Convert validation errors to user-friendly embed
     */
    static createValidationErrorEmbed(validationResult, commandName, subcommandName) {
        const title = `❌ ${this.formatCommandName(commandName, subcommandName)} Failed`;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(title)
            .setColor(0xFF0000)
            .setTimestamp();
        // Add main error description
        if (validationResult.errors.length > 0) {
            embed.setDescription('The following validation errors occurred:');
            // Group similar errors
            const errorGroups = this.groupErrors(validationResult.errors);
            errorGroups.forEach((errors, category) => {
                embed.addFields({
                    name: `${this.getCategoryEmoji(category)} ${category}`,
                    value: errors.map(e => `• ${e}`).join('\n').substring(0, 1024),
                    inline: false
                });
            });
        }
        // Add warnings if any
        if (validationResult.warnings.length > 0) {
            embed.addFields({
                name: '⚠️ Warnings',
                value: validationResult.warnings.map(w => `• ${w}`).join('\n').substring(0, 1024),
                inline: false
            });
        }
        // Add bypass information if available
        if (validationResult.requiresConfirmation && validationResult.bypassRequests) {
            embed.addFields({
                name: '🔓 Override Available',
                value: 'As the guild owner, you can override these validations. Click the button below to proceed.',
                inline: false
            });
        }
        // Add helpful suggestions
        const suggestions = this.getSuggestionsForErrors(validationResult);
        if (suggestions.length > 0) {
            embed.addFields({
                name: '💡 Suggestions',
                value: suggestions.map(s => `• ${s}`).join('\n').substring(0, 1024),
                inline: false
            });
        }
        return embed;
    }
    /**
     * Create interactive embed for specific validation failures
     */
    static createDetailedValidationEmbed(validationResult, context) {
        // Handle role limit validation
        if (this.isRoleLimitValidation(validationResult)) {
            return this.createRoleLimitEmbed(validationResult);
        }
        // Handle case limit validation
        if (this.isCaseLimitValidation(validationResult)) {
            return this.createCaseLimitEmbed(validationResult);
        }
        // Handle staff validation
        if (this.isStaffValidation(validationResult)) {
            return this.createStaffValidationEmbed(validationResult);
        }
        // Handle permission validation
        if (this.isPermissionValidation(validationResult)) {
            return this.createPermissionValidationEmbed(validationResult);
        }
        // Default validation embed
        return this.createGenericValidationEmbed(validationResult, context);
    }
    /**
     * Create bypass confirmation embed
     */
    static createBypassConfirmationEmbed(bypassRequests) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('⚠️ Validation Override Confirmation')
            .setColor(0xFFCC00)
            .setDescription('You are about to override the following validations:')
            .setTimestamp();
        bypassRequests.forEach((request, index) => {
            const validation = request.validationResult;
            embed.addFields({
                name: `Validation ${index + 1}`,
                value: validation.errors.join('\n').substring(0, 1024),
                inline: false
            });
        });
        embed.addFields({
            name: '⚠️ Warning',
            value: 'Overriding validations may lead to unexpected behavior or data inconsistencies.',
            inline: false
        }, {
            name: '📝 Next Step',
            value: 'Please provide a reason for this override in the modal that will appear.',
            inline: false
        });
        return embed;
    }
    /**
     * Create success embed after validation bypass
     */
    static createBypassSuccessEmbed(commandName, subcommandName, bypassReason) {
        return new discord_js_1.EmbedBuilder()
            .setTitle('✅ Validation Override Successful')
            .setColor(0x00FF00)
            .setDescription(`The ${this.formatCommandName(commandName, subcommandName)} command has been executed with validation override.`)
            .addFields({
            name: '📝 Override Reason',
            value: bypassReason,
            inline: false
        }, {
            name: '⚠️ Note',
            value: 'This action has been logged for audit purposes.',
            inline: false
        })
            .setTimestamp();
    }
    /**
     * Create action buttons for validation errors
     */
    static createValidationActionButtons(validationResult, isGuildOwner) {
        const buttons = [];
        // Add bypass button if available
        if (validationResult.requiresConfirmation && isGuildOwner) {
            buttons.push(new discord_js_1.ButtonBuilder()
                .setCustomId('validation_bypass_confirm')
                .setLabel('Override Validation')
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setEmoji('⚠️'));
        }
        // Add help button
        buttons.push(new discord_js_1.ButtonBuilder()
            .setCustomId('validation_help')
            .setLabel('Get Help')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('❓'));
        // Add cancel button
        buttons.push(new discord_js_1.ButtonBuilder()
            .setCustomId('validation_cancel')
            .setLabel('Cancel')
            .setStyle(discord_js_1.ButtonStyle.Secondary));
        return buttons.length > 0
            ? new discord_js_1.ActionRowBuilder().addComponents(buttons)
            : null;
    }
    // Private helper methods
    static createRoleLimitEmbed(validation) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: '❌ Role Limit Reached',
            description: `Cannot hire another **${validation.roleName}**. The maximum limit has been reached.`
        });
        embed.addFields({
            name: '📊 Current Status',
            value: `**${validation.currentCount}** / **${validation.maxCount}** positions filled`,
            inline: true
        }, {
            name: '👥 Role',
            value: validation.roleName,
            inline: true
        });
        // Add role hierarchy info
        const hierarchy = role_utils_1.RoleUtils.getRoleHierarchy();
        embed.addFields({
            name: '📈 Role Limits',
            value: hierarchy.map(role => {
                const maxCount = role_utils_1.RoleUtils.getRoleMaxCount(role);
                return `**${role}**: Max ${maxCount}`;
            }).join('\n'),
            inline: false
        });
        if (validation.bypassAvailable) {
            embed.addFields({
                name: '🔓 Override Option',
                value: 'As the guild owner, you can override this limit if necessary.',
                inline: false
            });
        }
        return embed;
    }
    static createCaseLimitEmbed(validation) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: '❌ Client Case Limit Reached',
            description: 'This client has reached the maximum number of active cases.'
        });
        embed.addFields({
            name: '📊 Active Cases',
            value: `**${validation.currentCases}** / **${validation.maxCases}**`,
            inline: true
        }, {
            name: '👤 Client',
            value: `<@${validation.clientId}>`,
            inline: true
        });
        embed.addFields({
            name: '💡 Suggestions',
            value: '• Close completed cases before opening new ones\n• Review and update the status of pending cases\n• Consider if existing cases can be consolidated',
            inline: false
        });
        return embed;
    }
    static createStaffValidationEmbed(validation) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: '❌ Staff Validation Failed',
            description: validation.errors.join('\n')
        });
        if (!validation.isActiveStaff) {
            embed.addFields({
                name: '❓ Issue',
                value: 'The specified user is not an active staff member.',
                inline: false
            });
        }
        if (!validation.hasRequiredPermissions) {
            embed.addFields({
                name: '🔒 Permissions',
                value: 'The user lacks the required permissions for this operation.',
                inline: false
            });
        }
        if (validation.currentRole) {
            embed.addFields({
                name: '👤 Current Role',
                value: validation.currentRole,
                inline: true
            });
        }
        return embed;
    }
    static createPermissionValidationEmbed(validation) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: '❌ Permission Denied',
            description: `You do not have the required permission: **${validation.requiredPermission}**`
        });
        if (validation.grantedPermissions.length > 0) {
            embed.addFields({
                name: '✅ Your Permissions',
                value: validation.grantedPermissions.map(p => `• ${p}`).join('\n') || 'None',
                inline: false
            });
        }
        embed.addFields({
            name: '💡 How to Get This Permission',
            value: '• Ask an administrator to grant you the permission\n• Check if you have the correct Discord role\n• Verify your staff role has this permission',
            inline: false
        });
        return embed;
    }
    static createGenericValidationEmbed(validation, context) {
        const embed = embed_utils_1.EmbedUtils.createAALegalEmbed({
            title: `❌ ${this.formatCommandName(context.commandName, context.subcommandName)} Validation Failed`,
            description: 'The command could not be executed due to validation errors.'
        });
        if (validation.errors.length > 0) {
            embed.addFields({
                name: '❌ Errors',
                value: validation.errors.map(e => `• ${e}`).join('\n').substring(0, 1024),
                inline: false
            });
        }
        if (validation.warnings.length > 0) {
            embed.addFields({
                name: '⚠️ Warnings',
                value: validation.warnings.map(w => `• ${w}`).join('\n').substring(0, 1024),
                inline: false
            });
        }
        return embed;
    }
    static formatCommandName(commandName, subcommandName) {
        const formatted = commandName.charAt(0).toUpperCase() + commandName.slice(1);
        if (subcommandName) {
            const subFormatted = subcommandName.charAt(0).toUpperCase() + subcommandName.slice(1);
            return `${formatted} ${subFormatted}`;
        }
        return formatted;
    }
    static groupErrors(errors) {
        const groups = new Map();
        errors.forEach(error => {
            let category = 'General';
            if (error.toLowerCase().includes('permission')) {
                category = 'Permissions';
            }
            else if (error.toLowerCase().includes('limit')) {
                category = 'Limits';
            }
            else if (error.toLowerCase().includes('staff')) {
                category = 'Staff';
            }
            else if (error.toLowerCase().includes('case')) {
                category = 'Cases';
            }
            else if (error.toLowerCase().includes('valid')) {
                category = 'Validation';
            }
            const categoryErrors = groups.get(category) || [];
            categoryErrors.push(error);
            groups.set(category, categoryErrors);
        });
        return groups;
    }
    static getCategoryEmoji(category) {
        const emojiMap = {
            'Permissions': '🔒',
            'Limits': '📊',
            'Staff': '👥',
            'Cases': '⚖️',
            'Validation': '✅',
            'General': '❌'
        };
        return emojiMap[category] || '❌';
    }
    static getSuggestionsForErrors(validationResult) {
        const suggestions = [];
        validationResult.errors.forEach(error => {
            if (error.includes('permission')) {
                suggestions.push('Contact an administrator to get the required permissions');
            }
            if (error.includes('limit') && error.includes('role')) {
                suggestions.push('Consider promoting existing staff or removing inactive members');
            }
            if (error.includes('case') && error.includes('limit')) {
                suggestions.push('Close completed cases before creating new ones');
            }
            if (error.includes('staff') && error.includes('not found')) {
                suggestions.push('Ensure the user is an active staff member');
            }
        });
        return [...new Set(suggestions)]; // Remove duplicates
    }
    static isRoleLimitValidation(validation) {
        return 'currentCount' in validation && 'maxCount' in validation && 'roleName' in validation;
    }
    static isCaseLimitValidation(validation) {
        return 'currentCases' in validation && 'maxCases' in validation && 'clientId' in validation;
    }
    static isStaffValidation(validation) {
        return 'isActiveStaff' in validation && 'hasRequiredPermissions' in validation;
    }
    static isPermissionValidation(validation) {
        return 'hasPermission' in validation && 'requiredPermission' in validation && 'grantedPermissions' in validation;
    }
}
exports.ValidationErrorHandler = ValidationErrorHandler;
//# sourceMappingURL=validation-error-handler.js.map