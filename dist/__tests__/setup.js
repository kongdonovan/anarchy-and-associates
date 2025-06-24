"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
// Load test environment variables
(0, dotenv_1.config)({ path: '.env.test' });
// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/anarchy_associates_test';
process.env.MONGO_DATABASE = process.env.MONGO_DATABASE || 'anarchy_associates_test';
// This is just a setup file, no tests needed
describe('Test Setup', () => {
    it('should load environment variables', () => {
        expect(process.env.NODE_ENV).toBe('test');
    });
});
//# sourceMappingURL=setup.js.map