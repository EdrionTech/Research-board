// Runs every *.test.js here, one after another (each starts its own server), and sums them up.
// `node run.js api` runs only the files whose names include "api".
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const only = process.argv.slice(2);
const files = fs.readdirSync(__dirname)
    .filter(name => name.endsWith('.test.js') && (!only.length || only.some(word => name.includes(word))));
const failed = [];
for (const file of files) {
    console.log(`\n== ${file}`);
    const { status } = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
    if (status !== 0) failed.push(file);
}
console.log(failed.length ? `\n${failed.length} of ${files.length} test files failed: ${failed.join(', ')}` : `\nAll ${files.length} test files passed`);
process.exitCode = failed.length ? 1 : 0;
