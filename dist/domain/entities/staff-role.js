"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleUtils = exports.ROLE_HIERARCHY = exports.StaffRole = void 0;
var StaffRole;
(function (StaffRole) {
    StaffRole["MANAGING_PARTNER"] = "Managing Partner";
    StaffRole["SENIOR_PARTNER"] = "Senior Partner";
    StaffRole["JUNIOR_PARTNER"] = "Junior Partner";
    StaffRole["SENIOR_ASSOCIATE"] = "Senior Associate";
    StaffRole["JUNIOR_ASSOCIATE"] = "Junior Associate";
    StaffRole["PARALEGAL"] = "Paralegal";
})(StaffRole || (exports.StaffRole = StaffRole = {}));
exports.ROLE_HIERARCHY = {
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
class RoleUtils {
    static canPromote(currentRole, targetRole) {
        const currentLevel = exports.ROLE_HIERARCHY[currentRole].level;
        const targetLevel = exports.ROLE_HIERARCHY[targetRole].level;
        // Only senior staff (Senior Partner and above) can promote
        return currentLevel >= 5 && targetLevel < currentLevel;
    }
    static canDemote(currentRole, targetRole) {
        const currentLevel = exports.ROLE_HIERARCHY[currentRole].level;
        const targetLevel = exports.ROLE_HIERARCHY[targetRole].level;
        // Only senior staff (Senior Partner and above) can demote
        return currentLevel >= 5 && targetLevel < currentLevel;
    }
    static getNextPromotion(role) {
        const currentLevel = exports.ROLE_HIERARCHY[role].level;
        const nextLevel = currentLevel + 1;
        const nextRole = Object.values(StaffRole).find(r => exports.ROLE_HIERARCHY[r].level === nextLevel);
        return nextRole || null;
    }
    static getPreviousDemotion(role) {
        const currentLevel = exports.ROLE_HIERARCHY[role].level;
        const previousLevel = currentLevel - 1;
        const previousRole = Object.values(StaffRole).find(r => exports.ROLE_HIERARCHY[r].level === previousLevel);
        return previousRole || null;
    }
    static getRoleMaxCount(role) {
        return exports.ROLE_HIERARCHY[role].maxCount;
    }
    static getRoleLevel(role) {
        return exports.ROLE_HIERARCHY[role].level;
    }
    static getAllRoles() {
        return Object.values(StaffRole);
    }
    static getAllRolesSortedByLevel() {
        return Object.values(StaffRole).sort((a, b) => exports.ROLE_HIERARCHY[b].level - exports.ROLE_HIERARCHY[a].level);
    }
    static isValidRole(role) {
        return Object.values(StaffRole).includes(role);
    }
}
exports.RoleUtils = RoleUtils;
//# sourceMappingURL=staff-role.js.map