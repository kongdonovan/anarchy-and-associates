/**
 * Enumeration of all available staff roles in the Anarchy & Associates law firm hierarchy.
 *
 * @description Defines the six-tier organizational structure of the law firm, from
 * entry-level Paralegals to the singular Managing Partner. Each role has specific
 * permissions, responsibilities, and position limits enforced by the system.
 *
 * @example
 * ```typescript
 * // Check if a user has senior management privileges
 * if (staffMember.role === StaffRole.SENIOR_PARTNER ||
 *     staffMember.role === StaffRole.MANAGING_PARTNER) {
 *   // Allow administrative actions
 * }
 *
 * // Promote a staff member
 * const canPromote = RoleUtils.canPromote(promoter.role, StaffRole.SENIOR_ASSOCIATE);
 * ```
 *
 * @see {@link RoleHierarchy} - Hierarchy configuration with levels and limits
 * @see {@link RoleUtils} - Utility functions for role management
 * @see {@link Staff} - Staff entity using these roles
 */
export declare enum StaffRole {
    /**
     * Managing Partner - The highest position in the firm (Level 6).
     * Limited to 1 person. Has full administrative control and oversees
     * all firm operations. Can promote/demote all staff.
     */
    MANAGING_PARTNER = "Managing Partner",
    /**
     * Senior Partner - Executive leadership position (Level 5).
     * Limited to 3 people. Can promote/demote staff below their level
     * and manage major firm decisions.
     */
    SENIOR_PARTNER = "Senior Partner",
    /**
     * Junior Partner - Partnership-track position (Level 4).
     * Limited to 5 people. Manages cases and client relationships
     * but has limited administrative privileges.
     */
    JUNIOR_PARTNER = "Junior Partner",
    /**
     * Senior Associate - Experienced attorney position (Level 3).
     * Limited to 10 people. Leads cases and mentors junior staff
     * but cannot make firm-wide decisions.
     */
    SENIOR_ASSOCIATE = "Senior Associate",
    /**
     * Junior Associate - Entry-level attorney position (Level 2).
     * Limited to 10 people. Works on cases under supervision
     * and handles routine legal tasks.
     */
    JUNIOR_ASSOCIATE = "Junior Associate",
    /**
     * Paralegal - Legal support staff position (Level 1).
     * Limited to 10 people. Provides administrative and research
     * support to attorneys but cannot lead cases.
     */
    PARALEGAL = "Paralegal"
}
/**
 * Configuration interface for staff role hierarchy and constraints.
 *
 * @description Defines the hierarchical structure, numerical levels, and position
 * limits for each role in the law firm. This ensures organizational structure
 * is maintained and prevents over-hiring at any level.
 *
 * @example
 * ```typescript
 * const seniorPartnerConfig: RoleHierarchy = {
 *   role: StaffRole.SENIOR_PARTNER,
 *   level: 5, // Second highest in hierarchy
 *   maxCount: 3, // Maximum 3 Senior Partners allowed
 *   discordRoleId: '123456789012345678' // Optional Discord role ID
 * };
 * ```
 *
 * @see {@link StaffRole} - Enumeration of available roles
 * @see {@link ROLE_HIERARCHY} - Complete hierarchy configuration
 * @see {@link RoleUtils} - Utilities using this configuration
 */
export interface RoleHierarchy {
    /**
     * The staff role this configuration applies to.
     * @property {StaffRole} role - One of the six defined staff roles
     */
    role: StaffRole;
    /**
     * Numerical hierarchy level (1-6, with 6 being highest).
     * Used for permission checks and promotion/demotion logic.
     * Higher numbers indicate more senior positions.
     * @property {number} level - Hierarchy level from 1 (Paralegal) to 6 (Managing Partner)
     */
    level: number;
    /**
     * Maximum number of staff members allowed at this role level.
     * Enforced during hiring and promotion to maintain organizational balance.
     * @property {number} maxCount - Position limit for this role
     */
    maxCount: number;
    /**
     * Optional Discord role ID for automatic role synchronization.
     * When set, the bot can automatically assign/remove Discord roles
     * based on staff database changes.
     * @property {string} [discordRoleId] - Discord role snowflake ID
     */
    discordRoleId?: string;
}
/**
 * Complete role hierarchy configuration for the Anarchy & Associates law firm.
 *
 * @description Maps each staff role to its hierarchical configuration including
 * level, position limits, and optional Discord role IDs. This is the source of
 * truth for all role-based logic in the system.
 *
 * Hierarchy levels:
 * - Level 6: Managing Partner (1 max) - Full administrative control
 * - Level 5: Senior Partner (3 max) - Executive leadership
 * - Level 4: Junior Partner (5 max) - Partnership track
 * - Level 3: Senior Associate (10 max) - Experienced attorneys
 * - Level 2: Junior Associate (10 max) - Entry-level attorneys
 * - Level 1: Paralegal (10 max) - Legal support staff
 *
 * @example
 * ```typescript
 * // Check if a role can be filled
 * const currentCount = await staffRepository.countByRole(guildId, StaffRole.SENIOR_PARTNER);
 * const maxAllowed = ROLE_HIERARCHY[StaffRole.SENIOR_PARTNER].maxCount;
 * if (currentCount >= maxAllowed) {
 *   throw new Error('Maximum Senior Partners reached');
 * }
 *
 * // Get hierarchy level for permission checks
 * const userLevel = ROLE_HIERARCHY[user.role].level;
 * const requiredLevel = 5; // Senior Partner or above
 * if (userLevel >= requiredLevel) {
 *   // Allow administrative action
 * }
 * ```
 *
 * @see {@link StaffRole} - Role enumeration
 * @see {@link RoleHierarchy} - Configuration interface
 * @see {@link RoleUtils} - Utility functions using this configuration
 */
export declare const ROLE_HIERARCHY: Record<StaffRole, RoleHierarchy>;
/**
 * Utility class providing helper methods for staff role management and hierarchy operations.
 *
 * @description Centralizes all role-related business logic including permission checks,
 * promotion/demotion validation, and hierarchy navigation. All methods are static and
 * operate on the ROLE_HIERARCHY configuration.
 *
 * @example
 * ```typescript
 * // Check if a Senior Partner can promote someone to Junior Partner
 * const canPromote = RoleUtils.canPromote(StaffRole.SENIOR_PARTNER, StaffRole.JUNIOR_PARTNER);
 *
 * // Get the next promotion level for a Junior Associate
 * const nextRole = RoleUtils.getNextPromotion(StaffRole.JUNIOR_ASSOCIATE);
 * // Returns: StaffRole.SENIOR_ASSOCIATE
 *
 * // Validate a role string from user input
 * if (RoleUtils.isValidRole(userInput)) {
 *   const role = userInput as StaffRole;
 *   // Safe to use as StaffRole
 * }
 * ```
 *
 * @see {@link StaffRole} - Role enumeration
 * @see {@link ROLE_HIERARCHY} - Role configuration
 * @see {@link Staff} - Staff entities using these utilities
 */
export declare class RoleUtils {
    /**
     * Determines if a staff member can promote another staff member to a target role.
     *
     * @description Only Senior Partners (level 5) and Managing Partners (level 6) have
     * promotion authority, and they can only promote to roles below their own level.
     *
     * @param {StaffRole} currentRole - The role of the staff member attempting to promote
     * @param {StaffRole} targetRole - The role being promoted to
     * @returns {boolean} True if the promotion is allowed, false otherwise
     *
     * @example
     * ```typescript
     * // Managing Partner promoting to Senior Partner
     * RoleUtils.canPromote(StaffRole.MANAGING_PARTNER, StaffRole.SENIOR_PARTNER); // true
     *
     * // Junior Partner attempting to promote (insufficient authority)
     * RoleUtils.canPromote(StaffRole.JUNIOR_PARTNER, StaffRole.JUNIOR_ASSOCIATE); // false
     *
     * // Senior Partner attempting to promote to their own level
     * RoleUtils.canPromote(StaffRole.SENIOR_PARTNER, StaffRole.SENIOR_PARTNER); // false
     * ```
     */
    static canPromote(currentRole: StaffRole, targetRole: StaffRole): boolean;
    /**
     * Determines if a staff member can demote another staff member from a target role.
     *
     * @description Follows the same authority rules as promotion - only Senior Partners
     * and above can demote, and only those below their level.
     *
     * @param {StaffRole} currentRole - The role of the staff member attempting to demote
     * @param {StaffRole} targetRole - The role of the staff member being demoted
     * @returns {boolean} True if the demotion is allowed, false otherwise
     *
     * @example
     * ```typescript
     * // Senior Partner demoting a Junior Associate
     * RoleUtils.canDemote(StaffRole.SENIOR_PARTNER, StaffRole.JUNIOR_ASSOCIATE); // true
     *
     * // Senior Partner attempting to demote Managing Partner
     * RoleUtils.canDemote(StaffRole.SENIOR_PARTNER, StaffRole.MANAGING_PARTNER); // false
     * ```
     */
    static canDemote(currentRole: StaffRole, targetRole: StaffRole): boolean;
    /**
     * Gets the next role in the promotion hierarchy.
     *
     * @description Returns the role that is one level above the current role,
     * or null if already at the highest level (Managing Partner).
     *
     * @param {StaffRole} role - Current role to find promotion for
     * @returns {StaffRole | null} Next role in hierarchy or null if at top
     *
     * @example
     * ```typescript
     * RoleUtils.getNextPromotion(StaffRole.PARALEGAL); // StaffRole.JUNIOR_ASSOCIATE
     * RoleUtils.getNextPromotion(StaffRole.JUNIOR_PARTNER); // StaffRole.SENIOR_PARTNER
     * RoleUtils.getNextPromotion(StaffRole.MANAGING_PARTNER); // null
     * ```
     */
    static getNextPromotion(role: StaffRole): StaffRole | null;
    /**
     * Gets the previous role in the demotion hierarchy.
     *
     * @description Returns the role that is one level below the current role,
     * or null if already at the lowest level (Paralegal).
     *
     * @param {StaffRole} role - Current role to find demotion for
     * @returns {StaffRole | null} Previous role in hierarchy or null if at bottom
     *
     * @example
     * ```typescript
     * RoleUtils.getPreviousDemotion(StaffRole.SENIOR_ASSOCIATE); // StaffRole.JUNIOR_ASSOCIATE
     * RoleUtils.getPreviousDemotion(StaffRole.MANAGING_PARTNER); // StaffRole.SENIOR_PARTNER
     * RoleUtils.getPreviousDemotion(StaffRole.PARALEGAL); // null
     * ```
     */
    static getPreviousDemotion(role: StaffRole): StaffRole | null;
    /**
     * Gets the maximum allowed count for a specific role.
     *
     * @description Used to enforce organizational limits during hiring and promotion.
     *
     * @param {StaffRole} role - Role to get limit for
     * @returns {number} Maximum allowed staff members at this role
     *
     * @example
     * ```typescript
     * const maxSeniorPartners = RoleUtils.getRoleMaxCount(StaffRole.SENIOR_PARTNER); // 3
     * const maxManagingPartners = RoleUtils.getRoleMaxCount(StaffRole.MANAGING_PARTNER); // 1
     * ```
     */
    static getRoleMaxCount(role: StaffRole): number;
    /**
     * Gets the numerical hierarchy level for a role.
     *
     * @description Higher numbers indicate more senior positions (1-6 scale).
     * Used for permission checks and hierarchy comparisons.
     *
     * @param {StaffRole} role - Role to get level for
     * @returns {number} Hierarchy level (1 for Paralegal, 6 for Managing Partner)
     *
     * @example
     * ```typescript
     * const level = RoleUtils.getRoleLevel(StaffRole.SENIOR_PARTNER); // 5
     * if (level >= 5) {
     *   // Has administrative privileges
     * }
     * ```
     */
    static getRoleLevel(role: StaffRole): number;
    /**
     * Gets all available staff roles.
     *
     * @description Returns all roles in the order they appear in the enum,
     * useful for populating dropdowns or iterating through all roles.
     *
     * @returns {StaffRole[]} Array of all staff roles
     *
     * @example
     * ```typescript
     * const allRoles = RoleUtils.getAllRoles();
     * // Use for Discord slash command choices
     * const choices = allRoles.map(role => ({ name: role, value: role }));
     * ```
     */
    static getAllRoles(): StaffRole[];
    /**
     * Gets all roles sorted by hierarchy level (highest to lowest).
     *
     * @description Useful for displaying organizational charts or role lists
     * in order of seniority.
     *
     * @returns {StaffRole[]} Array of roles sorted by level (Managing Partner first)
     *
     * @example
     * ```typescript
     * const rolesByLevel = RoleUtils.getAllRolesSortedByLevel();
     * // [Managing Partner, Senior Partner, Junior Partner, Senior Associate, Junior Associate, Paralegal]
     * ```
     */
    static getAllRolesSortedByLevel(): StaffRole[];
    /**
     * Type guard to validate if a string is a valid StaffRole.
     *
     * @description Safely validates user input or external data to ensure
     * it matches a valid staff role before casting.
     *
     * @param {string} role - String to validate
     * @returns {role is StaffRole} True if valid role, with TypeScript type narrowing
     *
     * @example
     * ```typescript
     * const userInput = interaction.options.getString('role');
     * if (RoleUtils.isValidRole(userInput)) {
     *   // TypeScript now knows userInput is StaffRole
     *   const staffRole: StaffRole = userInput;
     *   const level = RoleUtils.getRoleLevel(staffRole);
     * } else {
     *   throw new Error(`Invalid role: ${userInput}`);
     * }
     * ```
     */
    static isValidRole(role: string): role is StaffRole;
}
//# sourceMappingURL=staff-role.d.ts.map