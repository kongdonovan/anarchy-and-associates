import * as noblox from 'noblox.js';
import { logger } from '../logger';

export interface RobloxUser {
  id: number;
  username: string;
  displayName: string;
  description?: string;
  isOnline: boolean;
  joinDate: Date;
  profileUrl: string;
  avatarUrl: string;
}

export interface RobloxApiError {
  message: string;
  code?: number;
  isNotFound?: boolean;
}

export class RobloxService {
  private static instance: RobloxService;
  private readonly rateLimitDelay = 1000; // 1 second between requests
  private lastRequestTime = 0;

  private constructor() {}

  public static getInstance(): RobloxService {
    if (!RobloxService.instance) {
      RobloxService.instance = new RobloxService();
    }
    return RobloxService.instance;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  public async getUserByUsername(username: string): Promise<RobloxUser | null> {
    try {
      await this.rateLimit();
      
      logger.debug('Fetching Roblox user by username', { username });
      
      // Get user ID by username
      const userId = await noblox.getIdFromUsername(username);
      if (!userId) {
        logger.debug('User not found by username', { username });
        return null;
      }

      return await this.getUserById(userId);
    } catch (error) {
      logger.error('Error fetching Roblox user by username:', error);
      
      if (this.isUserNotFoundError(error)) {
        return null;
      }
      
      throw this.createRobloxError(error, `Failed to fetch user by username: ${username}`);
    }
  }

  public async getUserById(userId: number): Promise<RobloxUser | null> {
    try {
      await this.rateLimit();
      
      logger.debug('Fetching Roblox user by ID', { userId });
      
      // Get user info
      const userInfo = await noblox.getPlayerInfo(userId);
      if (!userInfo) {
        logger.debug('User not found by ID', { userId });
        return null;
      }

      // Get additional user details
      const [thumbnailData] = await Promise.allSettled([
        noblox.getPlayerThumbnail(userId, '420x420', 'png', false, 'headshot')
      ]);

      const avatarUrl = thumbnailData.status === 'fulfilled' && thumbnailData.value.length > 0 && thumbnailData.value[0]?.imageUrl
        ? thumbnailData.value[0].imageUrl
        : `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;

      const robloxUser: RobloxUser = {
        id: userId,
        username: userInfo.username || 'Unknown',
        displayName: userInfo.displayName || userInfo.username || 'Unknown',
        description: userInfo.blurb || undefined,
        isOnline: false, // Online status not reliably available
        joinDate: userInfo.joinDate ?? new Date(),
        profileUrl: `https://www.roblox.com/users/${userId}/profile`,
        avatarUrl: avatarUrl || `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`
      };

      logger.debug('Successfully fetched Roblox user', { userId, username: robloxUser.username });
      return robloxUser;
    } catch (error) {
      logger.error('Error fetching Roblox user by ID:', error);
      
      if (this.isUserNotFoundError(error)) {
        return null;
      }
      
      throw this.createRobloxError(error, `Failed to fetch user by ID: ${userId}`);
    }
  }

  public async validateUsername(username: string): Promise<{ isValid: boolean; user?: RobloxUser; error?: string }> {
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
    } catch (error) {
      logger.error('Error validating username:', error);
      return { 
        isValid: false, 
        error: 'Failed to validate username. Please try again later.' 
      };
    }
  }

  public async getUsernameById(userId: number): Promise<string | null> {
    try {
      await this.rateLimit();
      
      const username = await noblox.getUsernameFromId(userId);
      return username || null;
    } catch (error) {
      logger.error('Error fetching username by ID:', error);
      
      if (this.isUserNotFoundError(error)) {
        return null;
      }
      
      throw this.createRobloxError(error, `Failed to fetch username by ID: ${userId}`);
    }
  }

  private isUserNotFoundError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorBody = error?.response?.body?.toLowerCase() || '';
    
    return (
      errorMessage.includes('user not found') ||
      errorMessage.includes('invalid user') ||
      errorMessage.includes('user does not exist') ||
      errorBody.includes('user not found') ||
      errorBody.includes('invalid user') ||
      error?.response?.status === 404 ||
      error?.status === 404
    );
  }

  private createRobloxError(originalError: any, message: string): RobloxApiError {
    const robloxError: RobloxApiError = {
      message,
      isNotFound: this.isUserNotFoundError(originalError)
    };

    if (originalError?.response?.status) {
      robloxError.code = originalError.response.status;
    } else if (originalError?.status) {
      robloxError.code = originalError.status;
    }

    return robloxError;
  }

  public formatUserForDisplay(user: RobloxUser): string {
    return `**${user.displayName}** (@${user.username})`;
  }

  public createProfileEmbed(user: RobloxUser) {
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