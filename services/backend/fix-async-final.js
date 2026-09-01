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

// Fix events.ts
replaceInFile(path.join(__dirname, 'src', 'agent', 'events.ts'), [
  { regex: /return await transaction\(\);/g, replacement: "return transaction();" } // transaction() is no longer awaited because it doesn't return a Promise, since callback is sync
]);

// Wait, if transaction() is sync, then in events.ts: 
// The problem is `export function appendAgentEvent(...)` returns `number`, but `transaction()` now returns a `Promise<any>`.
// So `appendAgentEvent` must be async and return Promise<number>.
replaceInFile(path.join(__dirname, 'src', 'agent', 'events.ts'), [
  { regex: /export function appendAgentEvent\(runId: string, eventType: string, payload: any = \{\}\): number \{/g, replacement: "export async function appendAgentEvent(runId: string, eventType: string, payload: any = {}): Promise<number> {" },
  { regex: /return transaction\(\);/g, replacement: "return await transaction();" }
]);

// Fix metrics.routes.ts
replaceInFile(path.join(__dirname, 'src', 'routes', 'metrics.routes.ts'), [
  { regex: /const computeStats = \(suiteTraces: any\[\]\) => \{/g, replacement: "const computeStats = async (suiteTraces: any[]) => {" },
  { regex: /computeStats\(/g, replacement: "await computeStats(" }
]);
