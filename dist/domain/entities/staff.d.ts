import { BaseEntity } from './base';
import { StaffRole } from './staff-role';
/**
 * Represents a staff member in the Anarchy & Associates legal firm.
 *
 * @description Core entity for managing employees within the Discord-based law firm.
 * Tracks employment status, role hierarchy, promotion history, and Discord integration.
 * The staff system enforces strict role limits and hierarchy rules as defined in
 * the firm's organizational structure.
 *
 * @example
 * ```typescript
 * const newStaff: Staff = {
 *   userId: '123456789012345678', // Discord user ID
 *   guildId: '987654321098765432', // Discord guild ID
 *   robloxUsername: 'JohnDoe123',
 *   role: StaffRole.JUNIOR_ASSOCIATE,
 *   hiredAt: new Date(),
 *   hiredBy: '111222333444555666', // Hiring manager's Discord ID
 *   promotionHistory: [{
 *     fromRole: StaffRole.JUNIOR_ASSOCIATE,
 *     toRole: StaffRole.JUNIOR_ASSOCIATE,
 *     promotedBy: '111222333444555666',
 *     promotedAt: new Date(),
 *     actionType: 'hire'
 *   }],
 *   status: 'active',
 *   discordRoleId: '555666777888999000', // Discord role ID for Junior Associate
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * };
 * ```
 *
 * @see {@link StaffRole} - Available roles in the hierarchy
 * @see {@link PromotionRecord} - Career progression tracking
 * @see {@link StaffService} - Business logic for staff management
 * @see {@link RoleTrackingService} - Discord role synchronization
 */
export interface Staff extends BaseEntity {
    /**
     * Discord user ID (snowflake) of the staff member.
     * Used to link the staff record to the Discord user and enable
     * role synchronization and permission checks.
     * @property {string} userId - Discord user snowflake ID
     */
    userId: string;
    /**
     * Discord guild ID (snowflake) where this staff member is employed.
     * Enables multi-guild support where each Discord server can have
     * its own independent staff roster.
     * @property {string} guildId - Discord guild snowflake ID
     */
    guildId: string;
    /**
     * Roblox username for cross-platform integration.
     * Used when the law firm operates in both Discord and Roblox environments,
     * enabling unified identity management.
     * @property {string} robloxUsername - Roblox platform username
     */
    robloxUsername: string;
    /**
     * Current role in the staff hierarchy.
     * Determines permissions, responsibilities, and position limits.
     * Role changes are tracked in promotionHistory.
     * @property {StaffRole} role - Current position in the firm hierarchy
     */
    role: StaffRole;
    /**
     * Timestamp when the staff member was initially hired.
     * Used for seniority calculations and employment duration tracking.
     * @property {Date} hiredAt - UTC timestamp of initial employment
     */
    hiredAt: Date;
    /**
     * Discord user ID of the manager who hired this staff member.
     * Provides accountability and audit trail for hiring decisions.
     * @property {string} hiredBy - Discord snowflake ID of hiring manager
     */
    hiredBy: string;
    /**
     * Complete history of all role changes throughout employment.
     * Ordered chronologically, with the most recent changes last.
     * Includes initial hiring, promotions, demotions, and termination if applicable.
     * @property {PromotionRecord[]} promotionHistory - Array of all role transitions
     */
    promotionHistory: PromotionRecord[];
    /**
     * Current employment status of the staff member.
     * - 'active': Currently employed and able to work
     * - 'inactive': Temporarily unavailable (e.g., leave of absence)
     * - 'terminated': No longer employed at the firm
     * @property {'active' | 'inactive' | 'terminated'} status - Employment status
     */
    status: 'active' | 'inactive' | 'terminated';
    /**
     * Discord role ID associated with the staff member's current position.
     * Used for automatic role synchronization between the bot's database
     * and Discord's role system. Optional as roles might be managed manually.
     * @property {string} [discordRoleId] - Discord role snowflake ID for synchronization
     */
    discordRoleId?: string;
}
/**
 * Represents a single promotion or role change event in a staff member's career history.
 *
 * @description Tracks all role transitions including promotions, demotions, initial hiring,
 * and terminations. This provides a complete audit trail of a staff member's career
 * progression within the law firm.
 *
 * @example
 * ```typescript
 * const promotion: PromotionRecord = {
 *   fromRole: StaffRole.JUNIOR_ASSOCIATE,
 *   toRole: StaffRole.SENIOR_ASSOCIATE,
 *   promotedBy: '123456789', // Discord user ID of the promoting manager
 *   promotedAt: new Date(),
 *   reason: 'Outstanding performance in Q3 2024',
 *   actionType: 'promotion'
 * };
 * ```
 *
 * @see {@link Staff} - Staff entity containing promotion history
 * @see {@link StaffRole} - Available staff roles in the hierarchy
 * @see {@link AuditLog} - System-wide audit trail for all actions
 */
export interface PromotionRecord {
    /**
     * The staff role before the transition.
     * For initial hiring, this is typically the same as toRole.
     * @property {StaffRole} fromRole - Previous role in the hierarchy
     */
    fromRole: StaffRole;
    /**
     * The staff role after the transition.
     * For terminations, this might be a special indicator or the last held role.
     * @property {StaffRole} toRole - New role in the hierarchy
     */
    toRole: StaffRole;
    /**
     * Discord user ID of the staff member who authorized this role change.
     * Must have appropriate permissions (admin or HR) to perform role changes.
     * @property {string} promotedBy - Discord snowflake ID of the authorizing user
     */
    promotedBy: string;
    /**
     * Timestamp when the role change took effect.
     * Used for seniority calculations and historical reporting.
     * @property {Date} promotedAt - UTC timestamp of the role change
     */
    promotedAt: Date;
    /**
     * Optional explanation for the role change.
     * Useful for performance reviews and understanding promotion decisions.
     * @property {string} [reason] - Human-readable explanation for the transition
     */
    reason?: string;
    /**
     * Type of role transition that occurred.
     * - 'promotion': Moving up the hierarchy (e.g., Junior to Senior Associate)
     * - 'demotion': Moving down the hierarchy (e.g., Senior to Junior Associate)
     * - 'hire': Initial employment at the firm
     * - 'fire': Termination of employment
     * @property {'promotion' | 'demotion' | 'hire' | 'fire'} actionType - The nature of the role change
     */
    actionType: 'promotion' | 'demotion' | 'hire' | 'fire';
}
//# sourceMappingURL=staff.d.ts.map