"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const staff_role_1 = require("../../domain/entities/staff-role");
describe('StaffRole and RoleUtils', () => {
    describe('RoleUtils.canPromote', () => {
        it('should allow senior partners to promote lower roles', () => {
            expect(staff_role_1.RoleUtils.canPromote(staff_role_1.StaffRole.SENIOR_PARTNER, staff_role_1.StaffRole.JUNIOR_PARTNER)).toBe(true);
            expect(staff_role_1.RoleUtils.canPromote(staff_role_1.StaffRole.SENIOR_PARTNER, staff_role_1.StaffRole.SENIOR_ASSOCIATE)).toBe(true);
            expect(staff_role_1.RoleUtils.canPromote(staff_role_1.StaffRole.SENIOR_PARTNER, staff_role_1.StaffRole.PARALEGAL)).toBe(true);
        });
        it('should not allow junior staff to promote', () => {
            expect(staff_role_1.RoleUtils.canPromote(staff_role_1.StaffRole.JUNIOR_PARTNER, staff_role_1.StaffRole.SENIOR_ASSOCIATE)).toBe(false);
            expect(staff_role_1.RoleUtils.canPromote(staff_role_1.StaffRole.PARALEGAL, staff_role_1.StaffRole.JUNIOR_ASSOCIATE)).toBe(false);
        });
        it('should not allow promotion to same or higher level', () => {
            expect(staff_role_1.RoleUtils.canPromote(staff_role_1.StaffRole.SENIOR_PARTNER, staff_role_1.StaffRole.SENIOR_PARTNER)).toBe(false);
            expect(staff_role_1.RoleUtils.canPromote(staff_role_1.StaffRole.SENIOR_PARTNER, staff_role_1.StaffRole.MANAGING_PARTNER)).toBe(false);
        });
    });
    describe('RoleUtils.canDemote', () => {
        it('should allow senior partners to demote lower roles', () => {
            expect(staff_role_1.RoleUtils.canDemote(staff_role_1.StaffRole.SENIOR_PARTNER, staff_role_1.StaffRole.JUNIOR_PARTNER)).toBe(true);
            expect(staff_role_1.RoleUtils.canDemote(staff_role_1.StaffRole.MANAGING_PARTNER, staff_role_1.StaffRole.SENIOR_PARTNER)).toBe(true);
        });
        it('should not allow demotion to same or higher level', () => {
            expect(staff_role_1.RoleUtils.canDemote(staff_role_1.StaffRole.SENIOR_PARTNER, staff_role_1.StaffRole.SENIOR_PARTNER)).toBe(false);
            expect(staff_role_1.RoleUtils.canDemote(staff_role_1.StaffRole.JUNIOR_PARTNER, staff_role_1.StaffRole.SENIOR_PARTNER)).toBe(false);
        });
    });
    describe('RoleUtils.getNextPromotion', () => {
        it('should return next higher role', () => {
            expect(staff_role_1.RoleUtils.getNextPromotion(staff_role_1.StaffRole.PARALEGAL)).toBe(staff_role_1.StaffRole.JUNIOR_ASSOCIATE);
            expect(staff_role_1.RoleUtils.getNextPromotion(staff_role_1.StaffRole.JUNIOR_ASSOCIATE)).toBe(staff_role_1.StaffRole.SENIOR_ASSOCIATE);
            expect(staff_role_1.RoleUtils.getNextPromotion(staff_role_1.StaffRole.SENIOR_PARTNER)).toBe(staff_role_1.StaffRole.MANAGING_PARTNER);
        });
        it('should return null for highest role', () => {
            expect(staff_role_1.RoleUtils.getNextPromotion(staff_role_1.StaffRole.MANAGING_PARTNER)).toBeNull();
        });
    });
    describe('RoleUtils.getPreviousDemotion', () => {
        it('should return next lower role', () => {
            expect(staff_role_1.RoleUtils.getPreviousDemotion(staff_role_1.StaffRole.JUNIOR_ASSOCIATE)).toBe(staff_role_1.StaffRole.PARALEGAL);
            expect(staff_role_1.RoleUtils.getPreviousDemotion(staff_role_1.StaffRole.MANAGING_PARTNER)).toBe(staff_role_1.StaffRole.SENIOR_PARTNER);
        });
        it('should return null for lowest role', () => {
            expect(staff_role_1.RoleUtils.getPreviousDemotion(staff_role_1.StaffRole.PARALEGAL)).toBeNull();
        });
    });
    describe('RoleUtils.isValidRole', () => {
        it('should validate correct role strings', () => {
            expect(staff_role_1.RoleUtils.isValidRole('Managing Partner')).toBe(true);
            expect(staff_role_1.RoleUtils.isValidRole('Senior Partner')).toBe(true);
            expect(staff_role_1.RoleUtils.isValidRole('Paralegal')).toBe(true);
        });
        it('should reject invalid role strings', () => {
            expect(staff_role_1.RoleUtils.isValidRole('Invalid Role')).toBe(false);
            expect(staff_role_1.RoleUtils.isValidRole('')).toBe(false);
            expect(staff_role_1.RoleUtils.isValidRole('admin')).toBe(false);
        });
    });
    describe('ROLE_HIERARCHY', () => {
        it('should have correct max counts', () => {
            expect(staff_role_1.ROLE_HIERARCHY[staff_role_1.StaffRole.MANAGING_PARTNER].maxCount).toBe(1);
            expect(staff_role_1.ROLE_HIERARCHY[staff_role_1.StaffRole.SENIOR_PARTNER].maxCount).toBe(3);
            expect(staff_role_1.ROLE_HIERARCHY[staff_role_1.StaffRole.JUNIOR_PARTNER].maxCount).toBe(5);
            expect(staff_role_1.ROLE_HIERARCHY[staff_role_1.StaffRole.PARALEGAL].maxCount).toBe(10);
        });
        it('should have correct hierarchy levels', () => {
            expect(staff_role_1.ROLE_HIERARCHY[staff_role_1.StaffRole.MANAGING_PARTNER].level).toBe(6);
            expect(staff_role_1.ROLE_HIERARCHY[staff_role_1.StaffRole.SENIOR_PARTNER].level).toBe(5);
            expect(staff_role_1.ROLE_HIERARCHY[staff_role_1.StaffRole.JUNIOR_PARTNER].level).toBe(4);
            expect(staff_role_1.ROLE_HIERARCHY[staff_role_1.StaffRole.SENIOR_ASSOCIATE].level).toBe(3);
            expect(staff_role_1.ROLE_HIERARCHY[staff_role_1.StaffRole.JUNIOR_ASSOCIATE].level).toBe(2);
            expect(staff_role_1.ROLE_HIERARCHY[staff_role_1.StaffRole.PARALEGAL].level).toBe(1);
        });
    });
});
//# sourceMappingURL=staff-role.test.js.map