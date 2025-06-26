const fs = require('fs');

// Read the file
let content = fs.readFileSync('src/presentation/commands/case-commands.ts', 'utf8');

// Pattern to find method definitions that use interaction
const methodPattern = /async\s+(\w+)\s*\([^)]*interaction:\s*CommandInteraction[^)]*\)\s*:\s*Promise<void>\s*{/g;
let currentMethod = null;
let methodStack = [];

// Split content into lines for processing
const lines = content.split('\n');
const newLines = [];
let contextAdded = new Set();

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  // Check if this is a method start
  const methodMatch = line.match(/async\s+(\w+)\s*\(/);
  if (methodMatch && line.includes('interaction: CommandInteraction')) {
    currentMethod = methodMatch[1];
    methodStack.push(currentMethod);
  }
  
  // Check if this line calls caseService
  if (line.includes('await this.caseService.') && currentMethod) {
    // Check if we already added context for this method
    if (!contextAdded.has(currentMethod)) {
      // Find the try block or method start
      let insertIndex = i;
      for (let j = i; j >= 0; j--) {
        if (lines[j].trim() === 'try {' || lines[j].includes('): Promise<void> {')) {
          insertIndex = j + 1;
          break;
        }
      }
      
      // Insert context retrieval
      if (!lines[insertIndex - 1].includes('getPermissionContext')) {
        lines.splice(insertIndex, 0, '      const context = await this.getPermissionContext(interaction);');
        i++; // Adjust current index
        contextAdded.add(currentMethod);
      }
    }
    
    // Fix the caseService call - add context as first parameter
    const serviceCallMatch = line.match(/await\s+this\.caseService\.(\w+)\(/);
    if (serviceCallMatch) {
      const methodName = serviceCallMatch[1];
      
      // Special handling for different methods
      if (methodName === 'getCaseReviewCategoryId') {
        line = line.replace(
          /await\s+this\.caseService\.getCaseReviewCategoryId\(([^)]+)\)/,
          'await this.caseService.getCaseReviewCategoryId(context, $1)'
        );
      } else if (methodName === 'createCase' || methodName === 'assignLawyer' || 
                 methodName === 'getCaseByCaseNumber' || methodName === 'getCaseById' ||
                 methodName === 'closeCase' || methodName === 'searchCases' ||
                 methodName === 'reassignLawyer' || methodName === 'unassignLawyer' ||
                 methodName === 'updateCase') {
        // Add context as first parameter
        line = line.replace(
          new RegExp(`await\\s+this\\.caseService\\.${methodName}\\(`),
          `await this.caseService.${methodName}(context, `
        );
      }
    }
  }
  
  // Check for method end
  if (line.trim() === '}' && methodStack.length > 0) {
    methodStack.pop();
    if (methodStack.length === 0) {
      currentMethod = null;
    }
  }
  
  newLines.push(line);
}

// Write the fixed content
fs.writeFileSync('src/presentation/commands/case-commands.ts', newLines.join('\n'));
console.log('Fixed case-commands.ts');