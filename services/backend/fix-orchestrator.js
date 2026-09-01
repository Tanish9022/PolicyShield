const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'gateway', 'orchestrator.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/function logAudit/g, 'async function logAudit');
content = content.replace(/(?<!await\s)db\.prepare/g, 'await db.prepare');
content = content.replace(/(?<!await\s)logAudit\(/g, 'await logAudit(');
content = content.replace(/(?<!await\s)appendAgentEvent\(/g, 'await appendAgentEvent(');

fs.writeFileSync(file, content);
console.log('Fixed orchestrator.ts');
