import { Project, SyntaxKind, CallExpression } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: './tsconfig.json',
});

// We want to find db.prepare(...).run/get/all() and add await.
// Then we ensure their parent functions are async.

let madeChanges = false;

for (const sourceFile of project.getSourceFiles()) {
  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  let fileChanged = false;

  for (const call of calls) {
    const expression = call.getExpression();
    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression);
      if (!propAccess) continue;
      const name = propAccess.getName();
      
      if (['run', 'get', 'all'].includes(name)) {
        const innerExpression = propAccess.getExpression();
        if (innerExpression.getKind() === SyntaxKind.CallExpression) {
          const innerCall = innerExpression.asKind(SyntaxKind.CallExpression);
          const innerProp = innerCall?.getExpression().asKind(SyntaxKind.PropertyAccessExpression);
          
          if (innerProp && innerProp.getName() === 'prepare') {
            // It's db.prepare(...).run/get/all()
            // Check if it's already awaited
            let current = call.getParent();
            if (current && current.getKind() !== SyntaxKind.AwaitExpression) {
              
              // Now we must find the enclosing function and make it async
              while (current) {
                if (current.getKind() === SyntaxKind.FunctionDeclaration || 
                    current.getKind() === SyntaxKind.MethodDeclaration ||
                    current.getKind() === SyntaxKind.ArrowFunction ||
                    current.getKind() === SyntaxKind.FunctionExpression) {
                  const func = current as any;
                  if (!func.isAsync()) {
                    func.setIsAsync(true);
                  }
                  break;
                }
                current = current.getParent();
              }
              
              call.replaceWithText(`await ${call.getText()}`);
              fileChanged = true;
            }
          }
        }
      }
    }
  }

  // Also replace db.exec(schema) with await db.exec(schema)
  const execCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of execCalls) {
    const expression = call.getExpression();
    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression);
      if (propAccess?.getName() === 'exec') {
         if (propAccess.getExpression().getText() === 'db' || propAccess.getExpression().getText() === 'getDb()') {
            let current = call.getParent();
            if (current && current.getKind() !== SyntaxKind.AwaitExpression) {
              
              while (current) {
                if (current.getKind() === SyntaxKind.FunctionDeclaration || 
                    current.getKind() === SyntaxKind.MethodDeclaration ||
                    current.getKind() === SyntaxKind.ArrowFunction ||
                    current.getKind() === SyntaxKind.FunctionExpression) {
                  const func = current as any;
                  if (!func.isAsync()) {
                    func.setIsAsync(true);
                  }
                  break;
                }
                current = current.getParent();
              }
              
              call.replaceWithText(`await ${call.getText()}`);
              fileChanged = true;
            }
         }
      }
    }
  }

  if (fileChanged) {
    sourceFile.saveSync();
    madeChanges = true;
    console.log(`Updated ${sourceFile.getFilePath()}`);
  }
}

console.log(madeChanges ? "Refactoring complete." : "No changes made.");
