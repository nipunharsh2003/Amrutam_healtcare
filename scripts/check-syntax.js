const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function collectJavaScript(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectJavaScript(fullPath) : fullPath.endsWith('.js') ? [fullPath] : [];
  });
}

const files = ['src', 'database', 'tests'].flatMap(collectJavaScript);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Syntax checked ${files.length} JavaScript files.`);