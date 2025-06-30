import { BaseEntity } from './base';

/**
 * Represents a bot-managed rules message in a Discord channel.
 * Allows servers to maintain consistent, formatted rules that persist across bot restarts.
 */
export interface RulesChannel extends BaseEntity {
  /**
   * Discord guild ID where the rules channel exists
   */
  guildId: string;
  
  /**
   * Discord channel ID containing the rules message
   */
  channelId: string;
  
  /**
   * Discord message ID of the rules message (if it exists)
   */
  messageId?: string;
  
  /**
   * Title of the rules embed
   */
  title: string;
  
  /**
   * Main content/description of the rules
   */
  content: string;
  
  /**
   * Individual rules as an array for better formatting
   */
  rules: Rule[];
  
  /**
   * Embed color (hex value)
   */
  color?: number;
  
  /**
   * URL for thumbnail image
   */
  thumbnailUrl?: string;
  
  /**
   * URL for main image
   */
  imageUrl?: string;
  
  /**
   * Footer text
   */
  footer?: string;
  
  /**
   * Whether to show rule numbers (1., 2., etc.)
   */
  showNumbers?: boolean;
  
  /**
   * Additional fields for the embed (e.g., consequences, appeals process)
   */
  additionalFields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  
  /**
   * Discord user ID of who last updated the rules
   */
  lastUpdatedBy: string;
  
  /**
   * Timestamp of last update
   */
  lastUpdatedAt: Date;
}

/**
 * Represents a single rule
 */
export interface Rule {
  /**
   * Rule number/identifier
   */
  id: string;
  
  /**
   * Short title for the rule
   */
  title: string;
  
  /**
   * Full description of the rule
   */
  description: string;
  
  /**
   * Category (e.g., "General", "Voice", "Text", "Staff")
   */
  category?: string;
  
  /**
   * Severity level (for formatting or enforcement purposes)
   */
  severity?: 'low' | 'medium' | 'high' | 'critical';
  
  /**
   * Display order
   */
  order: number;
}