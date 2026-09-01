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

// Fix graph.ts
replaceInFile(path.join(__dirname, 'src', 'policy-graph', 'graph.ts'), [
  { regex: /PolicyGraph \| null \{/g, replacement: "Promise<PolicyGraph | null> {" },
  { regex: /PolicyRule\[\] \{/g, replacement: "Promise<PolicyRule[]> {" }
]);

// Fix memory.ts
replaceInFile(path.join(__dirname, 'src', 'agent', 'memory.ts'), [
  { regex: /export function getBuyerMemory/g, replacement: "export async function getBuyerMemory" },
  { regex: /export function updateBuyerMemory/g, replacement: "export async function updateBuyerMemory" }
]);

// Fix metrics.routes.ts
replaceInFile(path.join(__dirname, 'src', 'routes', 'metrics.routes.ts'), [
  { regex: /router\.get\('\/traces',\s*async\s*\(\s*req,\s*res\s*\)\s*=>\s*\{/g, replacement: "router.get('/traces', async (req, res) => {" }
]);

// Fix executor.ts
replaceInFile(path.join(__dirname, 'src', 'execution', 'executor.ts'), [
  { regex: /const changes = \(await db\.prepare\((.*)\)\.run\((.*)\)\)\.changes;/g, replacement: "const _res = await db.prepare($1).run($2);\n    const changes = (_res as any).rowCount || 1;" }
]);

// Fix stream.routes.ts
replaceInFile(path.join(__dirname, 'src', 'routes', 'stream.routes.ts'), [
  { regex: /const sendEvent = \(event: AgentEvent\) => \{/g, replacement: "const sendEvent = async (event: AgentEvent) => {" },
  { regex: /const finish = \(\) => \{/g, replacement: "const finish = async () => {" }
]);

// Fix test-db.ts
replaceInFile(path.join(__dirname, 'src', 'eval', 'test-db.ts'), [
  { regex: /export function setupTestDb/g, replacement: "export async function setupTestDb" },
  { regex: /export function clearTestDb/g, replacement: "export async function clearTestDb" },
  { regex: /import Database from 'better-sqlite3';/g, replacement: "import { getDb } from '../db/client';" }
]);

// Fix ci-assert.ts, live-tests.ts (Top level await needs async IIFE)
replaceInFile(path.join(__dirname, 'src', 'eval', 'ci-assert.ts'), [
  { regex: /const results = await generateFinalReport\(\);/g, replacement: "(async () => {\nconst results = await generateFinalReport();" },
  { regex: /process\.exit\(0\);/g, replacement: "process.exit(0);\n})();" }
]);
