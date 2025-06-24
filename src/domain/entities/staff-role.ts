export enum StaffRole {
  MANAGING_PARTNER = 'Managing Partner',
  SENIOR_PARTNER = 'Senior Partner',
  JUNIOR_PARTNER = 'Junior Partner',
  SENIOR_ASSOCIATE = 'Senior Associate',
  JUNIOR_ASSOCIATE = 'Junior Associate',
  PARALEGAL = 'Paralegal',
}

export interface RoleHierarchy {
  role: StaffRole;
  level: number;
  maxCount: number;
  discordRoleId?: string;
}

export const ROLE_HIERARCHY: Record<StaffRole, RoleHierarchy> = {
  [StaffRole.MANAGING_PARTNER]: {
    role: StaffRole.MANAGING_PARTNER,
    level: 6,
    maxCount: 1,
  },
  [StaffRole.SENIOR_PARTNER]: {
    role: StaffRole.SENIOR_PARTNER,
    level: 5,
    maxCount: 3,
  },
  [StaffRole.JUNIOR_PARTNER]: {
    role: StaffRole.JUNIOR_PARTNER,
    level: 4,
    maxCount: 5,
  },
  [StaffRole.SENIOR_ASSOCIATE]: {
    role: StaffRole.SENIOR_ASSOCIATE,
    level: 3,
    maxCount: 10,
  },
  [StaffRole.JUNIOR_ASSOCIATE]: {
    role: StaffRole.JUNIOR_ASSOCIATE,
    level: 2,
    maxCount: 10,
  },
  [StaffRole.PARALEGAL]: {
    role: StaffRole.PARALEGAL,
    level: 1,
    maxCount: 10,
  },
};

export class RoleUtils {
  static canPromote(currentRole: StaffRole, targetRole: StaffRole): boolean {
    const currentLevel = ROLE_HIERARCHY[currentRole].level;
    const targetLevel = ROLE_HIERARCHY[targetRole].level;
    
    // Only senior staff (Senior Partner and above) can promote
    return currentLevel >= 5 && targetLevel < currentLevel;
  }

  static canDemote(currentRole: StaffRole, targetRole: StaffRole): boolean {
    const currentLevel = ROLE_HIERARCHY[currentRole].level;
    const targetLevel = ROLE_HIERARCHY[targetRole].level;
    
    // Only senior staff (Senior Partner and above) can demote
    return currentLevel >= 5 && targetLevel < currentLevel;
  }

  static getNextPromotion(role: StaffRole): StaffRole | null {
    const currentLevel = ROLE_HIERARCHY[role].level;
    const nextLevel = currentLevel + 1;
    
    const nextRole = Object.values(StaffRole).find(
      r => ROLE_HIERARCHY[r].level === nextLevel
    );
    
    return nextRole || null;
  }

  static getPreviousDemotion(role: StaffRole): StaffRole | null {
    const currentLevel = ROLE_HIERARCHY[role].level;
    const previousLevel = currentLevel - 1;
    
    const previousRole = Object.values(StaffRole).find(
      r => ROLE_HIERARCHY[r].level === previousLevel
    );
    
    return previousRole || null;
  }

  static getRoleMaxCount(role: StaffRole): number {
    return ROLE_HIERARCHY[role].maxCount;
  }

  static getRoleLevel(role: StaffRole): number {
    return ROLE_HIERARCHY[role].level;
  }

  static getAllRoles(): StaffRole[] {
    return Object.values(StaffRole);
  }

  static getAllRolesSortedByLevel(): StaffRole[] {
    return Object.values(StaffRole).sort(
      (a, b) => ROLE_HIERARCHY[b].level - ROLE_HIERARCHY[a].level
    );
  }

  static isValidRole(role: string): role is StaffRole {
    return Object.values(StaffRole).includes(role as StaffRole);
  }
}