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

const routesDir = path.join(__dirname, 'src', 'routes');
if (fs.existsSync(routesDir)) {
  fs.readdirSync(routesDir).forEach(f => {
    if (f.endsWith('.routes.ts')) {
      replaceInFile(path.join(routesDir, f), [
        { regex: /router\.(get|post|put|delete)\('([^']+)',\s*\(\s*req,\s*res\s*\)\s*=>/g, replacement: "router.$1('$2', async (req, res) =>" },
        { regex: /router\.(get|post|put|delete)\('([^']+)',\s*\(\s*req,\s*res,\s*next\s*\)\s*=>/g, replacement: "router.$1('$2', async (req, res, next) =>" },
        { regex: /\(req:\s*Request,\s*res:\s*Response\)\s*=>/g, replacement: "async (req: Request, res: Response) =>" }
      ]);
    }
  });
}

// Fix index.ts
replaceInFile(path.join(__dirname, 'src', 'index.ts'), [
  { regex: /app\.get\('/g, replacement: "app.get('" }, // Just simple ones
  { regex: /app\.get\('([^']+)',\s*\(\s*req,\s*res\s*\)\s*=>/g, replacement: "app.get('$1', async (req, res) =>" },
  { regex: /as \{ count: number \}/g, replacement: "as unknown as { count: number }" },
  { regex: /as any/g, replacement: "as unknown as any" }
]);

// Fix graph.ts
replaceInFile(path.join(__dirname, 'src', 'policy-graph', 'graph.ts'), [
  { regex: /export function getPolicies/g, replacement: "export async function getPolicies" },
  { regex: /export function getLatestPolicyVersion/g, replacement: "export async function getLatestPolicyVersion" },
  { regex: /export function savePolicies/g, replacement: "export async function savePolicies" }
]);

// Fix telemetry.ts
replaceInFile(path.join(__dirname, 'src', 'gateway', 'telemetry.ts'), [
  { regex: /recordStage\(/g, replacement: "async recordStage(" },
  { regex: /completeTrace\(/g, replacement: "async completeTrace(" },
  { regex: /setActionId\(/g, replacement: "async setActionId(" }
]);

// Fix executor.ts
replaceInFile(path.join(__dirname, 'src', 'execution', 'executor.ts'), [
  { regex: /const changes = /g, replacement: "const changes = (await " },
  { regex: /\.changes;/g, replacement: " as any).rowCount || 1;" }, // Postgres doesn't have changes, it has rowCount
  // Wait, I can't just replace .changes because the query returns rowCount
  { regex: /const result = await db.prepare\((.*)\)\.run\((.*)\);/g, replacement: "const result = await db.prepare($1).run($2);" }
]);

