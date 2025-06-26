const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const fixes = {
  // Fix enum string literals to proper enum values
  enumFixes: [
    { pattern: /status:\s*['"]in[- ]progress['"]/gi, replacement: 'status: CaseStatus.IN_PROGRESS' },
    { pattern: /status:\s*['"]pending['"]/gi, replacement: 'status: CaseStatus.PENDING' },
    { pattern: /status:\s*['"]closed['"]/gi, replacement: 'status: CaseStatus.CLOSED' },
    { pattern: /priority:\s*['"]low['"]/gi, replacement: 'priority: CasePriority.LOW' },
    { pattern: /priority:\s*['"]medium['"]/gi, replacement: 'priority: CasePriority.MEDIUM' },
    { pattern: /priority:\s*['"]high['"]/gi, replacement: 'priority: CasePriority.HIGH' },
    { pattern: /priority:\s*['"]urgent['"]/gi, replacement: 'priority: CasePriority.URGENT' },
    { pattern: /status:\s*['"]active['"]/gi, replacement: 'status: RetainerStatus.ACTIVE' },
    { pattern: /rating:\s*['"]five[- ]star[s]?['"]/gi, replacement: 'rating: FeedbackRating.FIVE_STAR' },
  ],
  
  // Fix ObjectId usage
  objectIdFixes: [
    { pattern: /_id:\s*['"]([^'"]+)['"]/g, replacement: '_id: new ObjectId()' },
    { pattern: /_id:\s*'staff\d+'/g, replacement: '_id: new ObjectId()' },
    { pattern: /_id:\s*'case\d+'/g, replacement: '_id: new ObjectId()' },
    { pattern: /_id:\s*'job\d+'/g, replacement: '_id: new ObjectId()' },
  ],
  
  // Add missing BaseEntity properties
  baseEntityFixes: [
    {
      pattern: /(\{\s*_id:[^}]+?)(\s*\})/g,
      replacement: (match, p1, p2) => {
        if (!match.includes('createdAt') && !match.includes('updatedAt')) {
          return p1 + ',\n        createdAt: new Date(),\n        updatedAt: new Date()' + p2;
        }
        return match;
      }
    }
  ],
  
  // Fix service method calls to include PermissionContext
  serviceMethodFixes: [
    // Pattern: await service.method(arg1, arg2) -> await service.method(context, arg1, arg2)
    {
      services: ['caseService', 'staffService', 'applicationService', 'jobService', 'retainerService'],
      methods: ['createCase', 'assignLawyer', 'getCaseById', 'getCaseByCaseNumber', 'closeCase', 'updateCase',
                'hireStaff', 'promoteStaff', 'demoteStaff', 'fireStaff', 'getStaffInfo',
                'reviewApplication', 'getApplicationById', 'createJob', 'getJobDetails',
                'createRetainer', 'getActiveRetainers'],
      fix: (line, method, service) => {
        const regex = new RegExp(`await\\s+(?:this\\.)?${service}\\.${method}\\(`);
        if (regex.test(line) && !line.includes('context,')) {
          return line.replace(regex, `await this.${service}.${method}(context, `);
        }
        return line;
      }
    }
  ],
  
  // Add missing imports
  importFixes: [
    {
      check: (content) => content.includes('new ObjectId()') && !content.includes("import { ObjectId }"),
      import: "import { ObjectId } from 'mongodb';"
    },
    {
      check: (content) => content.includes('CaseStatus.') && !content.includes("import { CaseStatus"),
      import: "import { CaseStatus, CasePriority } from '../../domain/entities/case';"
    }
  ]
};

// Process files
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;
  
  // Apply enum fixes
  fixes.enumFixes.forEach(fix => {
    const newContent = content.replace(fix.pattern, fix.replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });
  
  // Apply ObjectId fixes
  fixes.objectIdFixes.forEach(fix => {
    const newContent = content.replace(fix.pattern, fix.replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });
  
  // Apply BaseEntity fixes
  fixes.baseEntityFixes.forEach(fix => {
    const newContent = content.replace(fix.pattern, fix.replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });
  
  // Apply service method fixes
  const lines = content.split('\n');
  let contextAdded = false;
  let inMethod = false;
  let methodName = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect method start
    if (line.includes('async ') && line.includes('(') && line.includes('interaction: CommandInteraction')) {
      inMethod = true;
      contextAdded = false;
      const match = line.match(/async\s+(\w+)\s*\(/);
      methodName = match ? match[1] : '';
    }
    
    // Add context if needed
    if (inMethod && !contextAdded && (line.includes('try {') || line.includes('): Promise'))) {
      if (!lines.slice(i, i + 5).some(l => l.includes('getPermissionContext'))) {
        lines.splice(i + 1, 0, '      const context = await this.getPermissionContext(interaction);');
        contextAdded = true;
        modified = true;
        i++;
      }
    }
    
    // Fix service method calls
    fixes.serviceMethodFixes.forEach(fix => {
      fix.services.forEach(service => {
        fix.methods.forEach(method => {
          const newLine = fix.fix(line, method, service);
          if (newLine !== line) {
            lines[i] = newLine;
            modified = true;
          }
        });
      });
    });
    
    // Detect method end
    if (inMethod && line.trim() === '}') {
      inMethod = false;
    }
  }
  
  if (modified) {
    content = lines.join('\n');
  }
  
  // Add missing imports
  let importsAdded = false;
  fixes.importFixes.forEach(fix => {
    if (fix.check(content)) {
      const importLines = content.split('\n');
      let lastImportIndex = 0;
      
      for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].startsWith('import ')) {
          lastImportIndex = i;
        }
      }
      
      importLines.splice(lastImportIndex + 1, 0, fix.import);
      content = importLines.join('\n');
      importsAdded = true;
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
  
  return modified;
}

// Find all TypeScript files to process
const patterns = [
  'src/**/*.test.ts',
  'src/presentation/commands/*.ts',
  'src/application/services/*.ts'
];

let totalFixed = 0;

patterns.forEach(pattern => {
  const files = glob.sync(pattern);
  files.forEach(file => {
    if (processFile(file)) {
      totalFixed++;
    }
  });
});

console.log(`\nTotal files fixed: ${totalFixed}`);