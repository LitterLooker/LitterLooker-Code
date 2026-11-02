import fs from 'fs';
import path from 'path';

function findKeyword(dir, kw) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.next' || file === 'dist' || file.startsWith('.')) continue;
    if (fs.statSync(fullPath).isDirectory()) {
      findKeyword(fullPath, kw);
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

console.log('--- SEARCHING FOR RADIUS / LEADERBOARD / MAPRADIUSFILTER ---');
findKeyword('.', 'mapradiusfilter');
findKeyword('.', 'leaderboard');
