import { UnifiedValidationService } from './unified-validation-service';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { PermissionService } from '../services/permission-service';
/**
 * Factory for creating and configuring the UnifiedValidationService
 */
export declare class ValidationServiceFactory {
    /**
     * Creates a fully configured UnifiedValidationService with all strategies
     */
    static createValidationService(repositories: {
        staffRepository: StaffRepository;
        caseRepository: CaseRepository;
        guildConfigRepository: GuildConfigRepository;
        jobRepository: JobRepository;
        applicationRepository: ApplicationRepository;
    }, services: {
        permissionService: PermissionService;
    }): UnifiedValidationService;
    /**
     * Creates a minimal validation service for testing
     */
    static createTestValidationService(strategies?: any[]): UnifiedValidationService;
}
//# sourceMappingURL=validation-service-factory.d.ts.map