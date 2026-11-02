import fs from 'fs';
import path from 'path';

function searchCode(dir, kw) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.next' || file === 'dist' || file.startsWith('.')) continue;
    if (fs.statSync(fullPath).isDirectory()) {
      searchCode(fullPath, kw);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(kw.toLowerCase())) {
          console.log(`${fullPath} Line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

console.log('--- SEARCHING FOR BULK / BONUS / ZONE ---');
searchCode('.', 'bulk');
searchCode('.', 'bonus');
searchCode('.', 'zones');
