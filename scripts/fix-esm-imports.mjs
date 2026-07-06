import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('Usage: fix-esm-imports.mjs <dist-dir>'); process.exit(1); }

let fixed = 0;
function processDir(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) processDir(p);
    else if (f.endsWith('.js')) {
      let content = readFileSync(p, 'utf8');
      const orig = content;
      // Match from './xxx' where xxx doesn't end with .js
      content = content.replace(/from\s+'(\.[^']+)'/g, (match, imp) => {
        if (imp.endsWith('.js') || imp.endsWith('.mjs') || imp.endsWith('.cjs') || imp.endsWith('.json')) return match;
        return `from '${imp}.js'`;
      });
      if (content !== orig) {
        writeFileSync(p, content);
        fixed++;
      }
    }
  }
}
processDir(dir);
console.log(`Fixed ${fixed} files`);
if (fixed === 0) {
  // Debug: show some imports
  const files = readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const f of files.slice(0,3)) {
    const content = readFileSync(join(dir, f), 'utf8');
    const imports = content.match(/from\s+'(\.[^']+)'/g);
    if (imports) console.log(`  ${f}: ${imports.join(', ')}`);
  }
}
