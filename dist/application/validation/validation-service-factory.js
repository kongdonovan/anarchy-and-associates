"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationServiceFactory = void 0;
const unified_validation_service_1 = require("./unified-validation-service");
const business_rule_validation_strategy_1 = require("./strategies/business-rule-validation-strategy");
const command_validation_strategy_1 = require("./strategies/command-validation-strategy");
const cross_entity_validation_strategy_1 = require("./strategies/cross-entity-validation-strategy");
const logger_1 = require("../../infrastructure/logger");
/**
 * Factory for creating and configuring the UnifiedValidationService
 */
class ValidationServiceFactory {
    /**
     * Creates a fully configured UnifiedValidationService with all strategies
     */
    static createValidationService(repositories, services) {
        logger_1.logger.info('Creating UnifiedValidationService with all strategies');
        const validationService = new unified_validation_service_1.UnifiedValidationService();
        // Register business rule validation strategy
        const businessRuleStrategy = new business_rule_validation_strategy_1.BusinessRuleValidationStrategy(repositories.staffRepository, repositories.caseRepository, repositories.guildConfigRepository, services.permissionService);
        validationService.registerStrategy(businessRuleStrategy);
        // Register command validation strategy
        const commandStrategy = new command_validation_strategy_1.CommandValidationStrategy();
        validationService.registerStrategy(commandStrategy);
        // Register cross-entity validation strategy
        const crossEntityStrategy = new cross_entity_validation_strategy_1.CrossEntityValidationStrategy(repositories.staffRepository, repositories.caseRepository, repositories.jobRepository, repositories.applicationRepository);
        validationService.registerStrategy(crossEntityStrategy);
        logger_1.logger.info('UnifiedValidationService created with 3 strategies');
        return validationService;
    }
    /**
     * Creates a minimal validation service for testing
     */
    static createTestValidationService(strategies = []) {
        const validationService = new unified_validation_service_1.UnifiedValidationService();
        strategies.forEach(strategy => {
            validationService.registerStrategy(strategy);
        });
        return validationService;
    }
}
exports.ValidationServiceFactory = ValidationServiceFactory;
//# sourceMappingURL=validation-service-factory.js.map