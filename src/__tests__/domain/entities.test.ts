import { GuildConfig, Staff, Job, Application, StaffRole } from '../../domain/entities';
import { ObjectId } from 'mongodb';

describe('Domain Entities', () => {
  describe('GuildConfig', () => {
    it('should have correct structure', () => {
      const config: GuildConfig = {
        _id: new ObjectId(),
        guildId: '123456789',
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: {
          admin: ['role1'],
          hr: ['role2'],
          case: ['role3'],
          config: ['role4'],
          retainer: ['role5'],
          repair: ['role6'],
        },
        adminRoles: ['admin_role'],
        adminUsers: ['user1'],
      };

      expect(config.guildId).toBe('123456789');
      expect(config.permissions).toBeDefined();
      expect(config.adminRoles).toHaveLength(1);
      expect(config.adminUsers).toHaveLength(1);
    });
  });

  describe('Staff', () => {
    it('should have correct structure', () => {
      const staff: Staff = {
        _id: new ObjectId(),
        userId: 'user123',
        guildId: 'guild123',
        robloxUsername: 'TestUser',
        role: StaffRole.JUNIOR_ASSOCIATE,
        hiredAt: new Date(),
        hiredBy: 'hr_user',
        promotionHistory: [],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(staff.userId).toBe('user123');
      expect(staff.status).toBe('active');
      expect(staff.promotionHistory).toEqual([]);
    });
  });

  describe('Job', () => {
    it('should have correct structure', () => {
      const job: Job = {
        _id: new ObjectId(),
        guildId: 'guild123',
        title: 'Senior Lawyer',
        description: 'Experienced lawyer position',
        staffRole: StaffRole.SENIOR_ASSOCIATE,
        roleId: 'role123',
        isOpen: true,
        questions: [],
        postedBy: 'hr_user',
        applicationCount: 0,
        hiredCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(job.title).toBe('Senior Lawyer');
      expect(job.isOpen).toBe(true);
      expect(job.questions).toEqual([]);
    });
  });

  describe('Application', () => {
    it('should have correct structure', () => {
      const application: Application = {
        _id: new ObjectId(),
        guildId: 'guild123',
        jobId: 'job123',
        applicantId: 'user123',
        robloxUsername: 'TestApplicant',
        answers: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(application.status).toBe('pending');
      expect(application.answers).toEqual([]);
      expect(application.applicantId).toBe('user123');
    });
  });
});