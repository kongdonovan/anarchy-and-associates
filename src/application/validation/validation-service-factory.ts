import { UnifiedValidationService } from './unified-validation-service';
import { BusinessRuleValidationStrategy } from './strategies/business-rule-validation-strategy';
import { CommandValidationStrategy } from './strategies/command-validation-strategy';
import { CrossEntityValidationStrategy } from './strategies/cross-entity-validation-strategy';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { CaseRepository } from '../../infrastructure/repositories/case-repository';
import { GuildConfigRepository } from '../../infrastructure/repositories/guild-config-repository';
import { JobRepository } from '../../infrastructure/repositories/job-repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application-repository';
import { PermissionService } from '../services/permission-service';
import { logger } from '../../infrastructure/logger';

/**
 * Factory for creating and configuring the UnifiedValidationService
 */
export class ValidationServiceFactory {
  /**
   * Creates a fully configured UnifiedValidationService with all strategies
   */
  static createValidationService(
    repositories: {
      staffRepository: StaffRepository;
      caseRepository: CaseRepository;
      guildConfigRepository: GuildConfigRepository;
      jobRepository: JobRepository;
      applicationRepository: ApplicationRepository;
    },
    services: {
      permissionService: PermissionService;
    }
  ): UnifiedValidationService {
    logger.info('Creating UnifiedValidationService with all strategies');

    const validationService = new UnifiedValidationService();

    // Register business rule validation strategy
    const businessRuleStrategy = new BusinessRuleValidationStrategy(
      repositories.staffRepository,
      repositories.caseRepository,
      repositories.guildConfigRepository,
      services.permissionService
    );
    validationService.registerStrategy(businessRuleStrategy);

    // Register command validation strategy
    const commandStrategy = new CommandValidationStrategy();
    validationService.registerStrategy(commandStrategy);

    // Register cross-entity validation strategy
    const crossEntityStrategy = new CrossEntityValidationStrategy(
      repositories.staffRepository,
      repositories.caseRepository,
      repositories.jobRepository,
      repositories.applicationRepository
    );
    validationService.registerStrategy(crossEntityStrategy);

    logger.info('UnifiedValidationService created with 3 strategies');

    return validationService;
  }

  /**
   * Creates a minimal validation service for testing
   */
  static createTestValidationService(
    strategies: any[] = []
  ): UnifiedValidationService {
    const validationService = new UnifiedValidationService();
    
    strategies.forEach(strategy => {
      validationService.registerStrategy(strategy);
    });

    return validationService;
  }
}