"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RobloxService = void 0;
const noblox = __importStar(require("noblox.js"));
const logger_1 = require("../logger");
class RobloxService {
    constructor() {
        this.rateLimitDelay = 1000; // 1 second between requests
        this.lastRequestTime = 0;
    }
    static getInstance() {
        if (!RobloxService.instance) {
            RobloxService.instance = new RobloxService();
        }
        return RobloxService.instance;
    }
    async rateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.rateLimitDelay) {
            const delay = this.rateLimitDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        this.lastRequestTime = Date.now();
    }
    async getUserByUsername(username) {
        try {
            await this.rateLimit();
            logger_1.logger.debug('Fetching Roblox user by username', { username });
            // Get user ID by username
            const userId = await noblox.getIdFromUsername(username);
            if (!userId) {
                logger_1.logger.debug('User not found by username', { username });
                return null;
            }
            return await this.getUserById(userId);
        }
        catch (error) {
            logger_1.logger.error('Error fetching Roblox user by username:', error);
            if (this.isUserNotFoundError(error)) {
                return null;
            }
            throw this.createRobloxError(error, `Failed to fetch user by username: ${username}`);
        }
    }
    async getUserById(userId) {
        try {
            await this.rateLimit();
            logger_1.logger.debug('Fetching Roblox user by ID', { userId });
            // Get user info
            const userInfo = await noblox.getPlayerInfo(userId);
            if (!userInfo) {
                logger_1.logger.debug('User not found by ID', { userId });
                return null;
            }
            // Get additional user details
            const [thumbnailData] = await Promise.allSettled([
                noblox.getPlayerThumbnail(userId, '420x420', 'png', false, 'headshot')
            ]);
            const avatarUrl = thumbnailData.status === 'fulfilled' && thumbnailData.value.length > 0 && thumbnailData.value[0]?.imageUrl
                ? thumbnailData.value[0].imageUrl
                : `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
            const robloxUser = {
                id: userId,
                username: userInfo.username || 'Unknown',
                displayName: userInfo.displayName || userInfo.username || 'Unknown',
                description: userInfo.blurb || undefined,
                isOnline: false, // Online status not reliably available
                joinDate: userInfo.joinDate ?? new Date(),
                profileUrl: `https://www.roblox.com/users/${userId}/profile`,
                avatarUrl: avatarUrl || `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`
            };
            logger_1.logger.debug('Successfully fetched Roblox user', { userId, username: robloxUser.username });
            return robloxUser;
        }
        catch (error) {
            logger_1.logger.error('Error fetching Roblox user by ID:', error);
            if (this.isUserNotFoundError(error)) {
                return null;
            }
            throw this.createRobloxError(error, `Failed to fetch user by ID: ${userId}`);
        }
    }
    async validateUsername(username) {
        try {
            if (!username || typeof username !== 'string' || username.trim().length === 0) {
                return { isValid: false, error: 'Username cannot be empty' };
            }
            // Roblox username validation rules
            const usernameRegex = /^[a-zA-Z0-9_]+$/;
            if (!usernameRegex.test(username)) {
                return { isValid: false, error: 'Username contains invalid characters. Only letters, numbers, and underscores are allowed.' };
            }
            if (username.length < 3 || username.length > 20) {
                return { isValid: false, error: 'Username must be between 3 and 20 characters long.' };
            }
            const user = await this.getUserByUsername(username);
            if (!user) {
                return { isValid: false, error: 'Roblox user not found with this username.' };
            }
            return { isValid: true, user };
        }
        catch (error) {
            logger_1.logger.error('Error validating username:', error);
            return {
                isValid: false,
                error: 'Failed to validate username. Please try again later.'
            };
        }
    }
    async getUsernameById(userId) {
        try {
            await this.rateLimit();
            const username = await noblox.getUsernameFromId(userId);
            return username || null;
        }
        catch (error) {
            logger_1.logger.error('Error fetching username by ID:', error);
            if (this.isUserNotFoundError(error)) {
                return null;
            }
            throw this.createRobloxError(error, `Failed to fetch username by ID: ${userId}`);
        }
    }
    isUserNotFoundError(error) {
        const errorMessage = error?.message?.toLowerCase() || '';
        const errorBody = error?.response?.body?.toLowerCase() || '';
        return (errorMessage.includes('user not found') ||
            errorMessage.includes('invalid user') ||
            errorMessage.includes('user does not exist') ||
            errorBody.includes('user not found') ||
            errorBody.includes('invalid user') ||
            error?.response?.status === 404 ||
            error?.status === 404);
    }
    createRobloxError(originalError, message) {
        const robloxError = {
            message,
            isNotFound: this.isUserNotFoundError(originalError)
        };
        if (originalError?.response?.status) {
            robloxError.code = originalError.response.status;
        }
        else if (originalError?.status) {
            robloxError.code = originalError.status;
        }
        return robloxError;
    }
    formatUserForDisplay(user) {
        return `**${user.displayName}** (@${user.username})`;
    }
    createProfileEmbed(user) {
        return {
            title: `${user.displayName} (@${user.username})`,
            url: user.profileUrl,
            thumbnail: { url: user.avatarUrl },
            fields: [
                { name: 'User ID', value: user.id.toString(), inline: true },
                { name: 'Online Status', value: user.isOnline ? '🟢 Online' : '⚫ Offline', inline: true },
                { name: 'Join Date', value: user.joinDate.toDateString(), inline: true }
            ],
            color: 0x00ff41
        };
    }
}
exports.RobloxService = RobloxService;
//# sourceMappingURL=roblox-service.js.map