const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      if (f.endsWith('.ts')) {
         callback(dirPath);
      }
    }
  });
}

const dir = path.join(__dirname, 'src');

walkDir(dir, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // Pattern: db.prepare(...).run/get/all(...)
  // We want to replace it with await db.prepare(...).run/get/all(...)
  // Note: we might already have await if the script partially worked, so we avoid duplicate await
  const regex = /(?<!await\s+)(db\.prepare\([^)]+\)\.(?:run|get|all)\([^)]*\))/g;
  
  content = content.replace(regex, 'await $1');

  // Also catch db.exec
  const execRegex = /(?<!await\s+)(db\.exec\([^)]+\))/g;
  content = content.replace(execRegex, 'await $1');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log("Updated", filePath);
  }
});
