const fs = require('fs');
const path = require('path');

// Files identified from the error output
const filesToFix = [
  'src/__tests__/application/case-service.test.ts',
  'src/__tests__/application/case-channel-archive-service.test.ts',
  'src/__tests__/application/services/cross-entity-validation-service.test.ts',
  'src/__tests__/application/staff-service.test.ts',
  'src/__tests__/domain/retainer-feedback.test.ts',
  'src/__tests__/infrastructure/enhanced-audit-log-repository.test.ts',
  'src/__tests__/integration/case-channel-archive-integration.test.ts',
  'src/__tests__/integration/business-rule-integration.test.ts',
  'src/tests/application/services/cross-entity-validation-service.test.ts',
  'src/tests/application/orphaned-channel-cleanup-service.test.ts'
];

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filePath} - file not found`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Fix 1: Malformed caseNumber with template literal and object properties mixed
  // Pattern: caseNumber: `${currentYear,\n  createdAt: new Date(),\n  updatedAt: new Date()}-XXXX-...`
  content = content.replace(
    /caseNumber:\s*`\$\{currentYear,\s*createdAt:\s*new\s+Date\(\),\s*updatedAt:\s*new\s+Date\(\)\}-(\d{4})-([^`]+)`/g,
    (match, num, rest) => {
      const year = new Date().getFullYear();
      return `caseNumber: '${year}-${num}-${rest}',\n      createdAt: new Date(),\n      updatedAt: new Date()`;
    }
  );

  // Fix 2: Simpler pattern for caseNumber issues
  content = content.replace(
    /caseNumber:\s*['"]?(\d{4})-(\d{4})-([^'",\s]+)['"]?\s*,?\s*createdAt:/g,
    "caseNumber: '$1-$2-$3',\n      createdAt:"
  );

  // Fix 3: Fix unterminated template literals by finding unmatched backticks
  let backtickCount = (content.match(/`/g) || []).length;
  if (backtickCount % 2 !== 0) {
    // Find lines ending with an opening backtick and no closing
    content = content.replace(/`([^`\n]+)$/gm, '`$1`');
  }

  // Fix 4: Fix duplicate ObjectId imports
  content = content.replace(
    /import\s*{\s*ObjectId\s*}\s*from\s*'mongodb';\s*import\s*{\s*ObjectId\s*}\s*from\s*'mongodb';/g,
    "import { ObjectId } from 'mongodb';"
  );

  // Fix 5: Fix object properties with extra commas
  content = content.replace(/,\s*,/g, ',');
  content = content.replace(/,\s*}/g, ' }');
  content = content.replace(/,\s*\)/g, ')');

  // Fix 6: Fix missing commas between object properties
  content = content.replace(
    /}\s*createdAt:\s*new\s+Date\(\)/g,
    '},\n      createdAt: new Date()'
  );

  // Fix 7: Fix status property duplicates
  content = content.replace(
    /(status:\s*\w+\.\w+),?\s*status:\s*\w+\.\w+,?/g,
    '$1,'
  );

  // Fix 8: Fix malformed RetainerStatus references
  content = content.replace(/RetainerStatus\.ACTIVE(?![\w.])/g, "'active'");
  content = content.replace(/RetainerStatus\.PENDING(?![\w.])/g, "'pending'");
  content = content.replace(/RetainerStatus\.SIGNED(?![\w.])/g, "'signed'");
  content = content.replace(/RetainerStatus\.CANCELLED(?![\w.])/g, "'cancelled'");

  // Fix 9: Fix lines that have case number patterns without quotes
  content = content.replace(
    /(\s+)(\d{4}-\d{4}-\w+)(\s*[,}])/g,
    "$1'$2'$3"
  );

  // Fix 10: Fix missing 'context' parameter in service method calls
  // Common pattern: await someService.method(arg1, arg2) -> await someService.method(context, arg1, arg2)
  const serviceMethodPatterns = [
    { service: 'caseService', methods: ['createCase', 'assignCase', 'closeCase', 'addNote', 'addDocument'] },
    { service: 'applicationService', methods: ['submitApplication', 'reviewApplication'] },
    { service: 'retainerService', methods: ['createRetainer', 'signRetainer', 'cancelRetainer'] },
    { service: 'staffService', methods: ['hireStaff', 'fireStaff', 'promoteStaff', 'demoteStaff'] }
  ];

  serviceMethodPatterns.forEach(({ service, methods }) => {
    methods.forEach(method => {
      // Look for calls without 'context' as first parameter
      const regex = new RegExp(`await\\s+(this\\.)?${service}\\.${method}\\((?!context)`, 'g');
      content = content.replace(regex, `await ${service}.${method}(context, `);
    });
  });

  // Save if changed
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${filePath}`);
  } else {
    console.log(`No changes needed for ${filePath}`);
  }
}

// Fix all identified files
filesToFix.forEach(fixFile);

console.log('\nDone fixing syntax errors!');