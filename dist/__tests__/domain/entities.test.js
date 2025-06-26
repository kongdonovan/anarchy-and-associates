"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const entities_1 = require("../../domain/entities");
const retainer_1 = require("../../domain/entities/retainer");
const mongodb_1 = require("mongodb");
const case_1 = require("../../domain/entities/case");
describe('Domain Entities', () => {
    describe('GuildConfig', () => {
        it('should have correct structure', () => {
            const config = {
                _id: new mongodb_1.ObjectId(),
                guildId: '123456789',
                createdAt: new Date(),
                updatedAt: new Date(),
                permissions: {
                    admin: ['role1'],
                    'senior-staff': ['role2'],
                    case: ['role3'],
                    config: ['role4'],
                    lawyer: ['role5'],
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
            const staff = {
                _id: new mongodb_1.ObjectId(),
                userId: 'user123',
                guildId: 'guild123',
                robloxUsername: 'TestUser',
                role: entities_1.StaffRole.JUNIOR_ASSOCIATE,
                hiredAt: new Date(),
                hiredBy: 'hr_user',
                promotionHistory: [],
                status: retainer_1.RetainerStatus.ACTIVE,
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
            const job = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild123',
                title: 'Senior Lawyer',
                description: 'Experienced lawyer position',
                staffRole: entities_1.StaffRole.SENIOR_ASSOCIATE,
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
            const application = {
                _id: new mongodb_1.ObjectId(),
                guildId: 'guild123',
                jobId: 'job123',
                applicantId: 'user123',
                robloxUsername: 'TestApplicant',
                answers: [],
                status: case_1.CaseStatus.PENDING,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            expect(application.status).toBe('pending');
            expect(application.answers).toEqual([]);
            expect(application.applicantId).toBe('user123');
        });
    });
});
//# sourceMappingURL=entities.test.js.map