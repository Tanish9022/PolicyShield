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

// Fix stream.routes.ts
replaceInFile(path.join(__dirname, 'src', 'routes', 'stream.routes.ts'), [
  { regex: /const existingEvents = getAgentEvents/g, replacement: "const existingEvents = await getAgentEvents" }
]);

// Fix runs.routes.ts
replaceInFile(path.join(__dirname, 'src', 'routes', 'runs.routes.ts'), [
  { regex: /const events = getAgentEvents/g, replacement: "const events = await getAgentEvents" }
]);
