import { StaffRole, RoleUtils, ROLE_HIERARCHY } from '../../domain/entities/staff-role';

describe('StaffRole and RoleUtils', () => {
  describe('RoleUtils.canPromote', () => {
    it('should allow senior partners to promote lower roles', () => {
      expect(RoleUtils.canPromote(StaffRole.SENIOR_PARTNER, StaffRole.JUNIOR_PARTNER)).toBe(true);
      expect(RoleUtils.canPromote(StaffRole.SENIOR_PARTNER, StaffRole.SENIOR_ASSOCIATE)).toBe(true);
      expect(RoleUtils.canPromote(StaffRole.SENIOR_PARTNER, StaffRole.PARALEGAL)).toBe(true);
    });

    it('should not allow junior staff to promote', () => {
      expect(RoleUtils.canPromote(StaffRole.JUNIOR_PARTNER, StaffRole.SENIOR_ASSOCIATE)).toBe(false);
      expect(RoleUtils.canPromote(StaffRole.PARALEGAL, StaffRole.JUNIOR_ASSOCIATE)).toBe(false);
    });

    it('should not allow promotion to same or higher level', () => {
      expect(RoleUtils.canPromote(StaffRole.SENIOR_PARTNER, StaffRole.SENIOR_PARTNER)).toBe(false);
      expect(RoleUtils.canPromote(StaffRole.SENIOR_PARTNER, StaffRole.MANAGING_PARTNER)).toBe(false);
    });
  });

  describe('RoleUtils.canDemote', () => {
    it('should allow senior partners to demote lower roles', () => {
      expect(RoleUtils.canDemote(StaffRole.SENIOR_PARTNER, StaffRole.JUNIOR_PARTNER)).toBe(true);
      expect(RoleUtils.canDemote(StaffRole.MANAGING_PARTNER, StaffRole.SENIOR_PARTNER)).toBe(true);
    });

    it('should not allow demotion to same or higher level', () => {
      expect(RoleUtils.canDemote(StaffRole.SENIOR_PARTNER, StaffRole.SENIOR_PARTNER)).toBe(false);
      expect(RoleUtils.canDemote(StaffRole.JUNIOR_PARTNER, StaffRole.SENIOR_PARTNER)).toBe(false);
    });
  });

  describe('RoleUtils.getNextPromotion', () => {
    it('should return next higher role', () => {
      expect(RoleUtils.getNextPromotion(StaffRole.PARALEGAL)).toBe(StaffRole.JUNIOR_ASSOCIATE);
      expect(RoleUtils.getNextPromotion(StaffRole.JUNIOR_ASSOCIATE)).toBe(StaffRole.SENIOR_ASSOCIATE);
      expect(RoleUtils.getNextPromotion(StaffRole.SENIOR_PARTNER)).toBe(StaffRole.MANAGING_PARTNER);
    });

    it('should return null for highest role', () => {
      expect(RoleUtils.getNextPromotion(StaffRole.MANAGING_PARTNER)).toBeNull();
    });
  });

  describe('RoleUtils.getPreviousDemotion', () => {
    it('should return next lower role', () => {
      expect(RoleUtils.getPreviousDemotion(StaffRole.JUNIOR_ASSOCIATE)).toBe(StaffRole.PARALEGAL);
      expect(RoleUtils.getPreviousDemotion(StaffRole.MANAGING_PARTNER)).toBe(StaffRole.SENIOR_PARTNER);
    });

    it('should return null for lowest role', () => {
      expect(RoleUtils.getPreviousDemotion(StaffRole.PARALEGAL)).toBeNull();
    });
  });

  describe('RoleUtils.isValidRole', () => {
    it('should validate correct role strings', () => {
      expect(RoleUtils.isValidRole('Managing Partner')).toBe(true);
      expect(RoleUtils.isValidRole('Senior Partner')).toBe(true);
      expect(RoleUtils.isValidRole('Paralegal')).toBe(true);
    });

    it('should reject invalid role strings', () => {
      expect(RoleUtils.isValidRole('Invalid Role')).toBe(false);
      expect(RoleUtils.isValidRole('')).toBe(false);
      expect(RoleUtils.isValidRole('admin')).toBe(false);
    });
  });

  describe('ROLE_HIERARCHY', () => {
    it('should have correct max counts', () => {
      expect(ROLE_HIERARCHY[StaffRole.MANAGING_PARTNER].maxCount).toBe(1);
      expect(ROLE_HIERARCHY[StaffRole.SENIOR_PARTNER].maxCount).toBe(3);
      expect(ROLE_HIERARCHY[StaffRole.JUNIOR_PARTNER].maxCount).toBe(5);
      expect(ROLE_HIERARCHY[StaffRole.PARALEGAL].maxCount).toBe(10);
    });

    it('should have correct hierarchy levels', () => {
      expect(ROLE_HIERARCHY[StaffRole.MANAGING_PARTNER].level).toBe(6);
      expect(ROLE_HIERARCHY[StaffRole.SENIOR_PARTNER].level).toBe(5);
      expect(ROLE_HIERARCHY[StaffRole.JUNIOR_PARTNER].level).toBe(4);
      expect(ROLE_HIERARCHY[StaffRole.SENIOR_ASSOCIATE].level).toBe(3);
      expect(ROLE_HIERARCHY[StaffRole.JUNIOR_ASSOCIATE].level).toBe(2);
      expect(ROLE_HIERARCHY[StaffRole.PARALEGAL].level).toBe(1);
    });
  });
});