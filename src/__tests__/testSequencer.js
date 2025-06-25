const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Define test priority order
    const testPriority = [
      // Core domain tests (fastest)
      'domain/',
      'helpers/',
      
      // Application layer tests
      'application/',
      
      // Infrastructure tests
      'infrastructure/',
      
      // Integration tests (slower)
      'integration/',
      
      // Specialized tests (slowest)
      'concurrency/',
      'error-handling/',
      'performance/',
      'rate-limiting/',
      'security/',
      'e2e/'
    ];

    return tests.sort((testA, testB) => {
      const pathA = testA.path;
      const pathB = testB.path;
      
      // Find priority index for each test
      const priorityA = testPriority.findIndex(dir => pathA.includes(dir));
      const priorityB = testPriority.findIndex(dir => pathB.includes(dir));
      
      // If both tests have priorities, sort by priority
      if (priorityA !== -1 && priorityB !== -1) {
        return priorityA - priorityB;
      }
      
      // If only one has priority, prioritize it
      if (priorityA !== -1) return -1;
      if (priorityB !== -1) return 1;
      
      // If neither has priority, maintain original order
      return 0;
    });
  }
}

module.exports = CustomSequencer;