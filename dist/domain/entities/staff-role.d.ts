export declare enum StaffRole {
    MANAGING_PARTNER = "Managing Partner",
    SENIOR_PARTNER = "Senior Partner",
    JUNIOR_PARTNER = "Junior Partner",
    SENIOR_ASSOCIATE = "Senior Associate",
    JUNIOR_ASSOCIATE = "Junior Associate",
    PARALEGAL = "Paralegal"
}
export interface RoleHierarchy {
    role: StaffRole;
    level: number;
    maxCount: number;
    discordRoleId?: string;
}
export declare const ROLE_HIERARCHY: Record<StaffRole, RoleHierarchy>;
export declare class RoleUtils {
    static canPromote(currentRole: StaffRole, targetRole: StaffRole): boolean;
    static canDemote(currentRole: StaffRole, targetRole: StaffRole): boolean;
    static getNextPromotion(role: StaffRole): StaffRole | null;
    static getPreviousDemotion(role: StaffRole): StaffRole | null;
    static getRoleMaxCount(role: StaffRole): number;
    static getRoleLevel(role: StaffRole): number;
    static getAllRoles(): StaffRole[];
    static getAllRolesSortedByLevel(): StaffRole[];
    static isValidRole(role: string): role is StaffRole;
}
//# sourceMappingURL=staff-role.d.ts.map