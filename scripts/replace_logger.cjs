const fs = require('fs');
const path = require('path');

const srcDir = 'd:\\projectz\\dropdesk\\src';

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    const hasConsoleLog = content.includes('console.log');
    const hasConsoleError = content.includes('console.error');
    
    if (!hasConsoleLog && !hasConsoleError) return;
    
    content = content.replace(/console\.log/g, 'logger.info');
    content = content.replace(/console\.error/g, 'logger.error');
    
    if (!content.includes('import logger from')) {
        // calculate relative path to src/infrastructure/logger
        const loggerDir = path.join(srcDir, 'infrastructure', 'logger');
        let relativePath = path.relative(path.dirname(filePath), loggerDir).replace(/\\/g, '/');
        if (!relativePath.startsWith('.')) {
            relativePath = './' + relativePath;
        }
        
        // Find the last import statement
        const importRegex = /^import\s+.*?['"].*?['"];?$/gm;
        let match;
        let lastImportIndex = 0;
        while ((match = importRegex.exec(content)) !== null) {
            lastImportIndex = match.index + match[0].length;
        }
        
        const importStatement = `\nimport logger from "${relativePath}"`;
        
        if (lastImportIndex > 0) {
            content = content.slice(0, lastImportIndex) + importStatement + content.slice(lastImportIndex);
        } else {
            // Insert after the first line if it's not empty, or at the top
            content = importStatement.trim() + '\n\n' + content;
        }
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated', filePath);
}

function walkDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.ts') && fullPath !== path.join(srcDir, 'infrastructure', 'logger', 'index.ts')) {
            processFile(fullPath);
        }
    });
}

walkDir(srcDir);
