const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;
  
  for (const { regex, replacement } of replacements) {
    content = content.replace(regex, replacement);
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log("Fixed", filePath);
  }
}

// Fix executor.ts
replaceInFile(path.join(__dirname, 'src', 'execution', 'executor.ts'), [
  { regex: /const graph = getPolicies/g, replacement: "const graph = await getPolicies" }
]);

// Fix orchestrator.ts
replaceInFile(path.join(__dirname, 'src', 'gateway', 'orchestrator.ts'), [
  { regex: /const graph = getPolicies/g, replacement: "const graph = await getPolicies" }
]);

// Fix events.ts
replaceInFile(path.join(__dirname, 'src', 'agent', 'events.ts'), [
  { regex: /return transaction\(\);/g, replacement: "return await transaction();" }
]);

// Fix memory.ts
replaceInFile(path.join(__dirname, 'src', 'agent', 'memory.ts'), [
  { regex: /Promise<boolean> \{/g, replacement: "Promise<boolean> {" },
  { regex: /export function getBuyerMemory/g, replacement: "export async function getBuyerMemory" }
]);

// Run the script and let's check
