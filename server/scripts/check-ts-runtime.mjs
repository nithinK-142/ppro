import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = resolve(serverRoot, 'src');
const packageJson = JSON.parse(await readFile(resolve(serverRoot, 'package.json'), 'utf8'));
const tsconfig = JSON.parse(await readFile(resolve(serverRoot, 'tsconfig.json'), 'utf8'));
const failures = [];

if (packageJson.type !== 'module') {
  failures.push('package.json must declare "type": "module" for the Node ESM TypeScript runtime');
}

if (!String(packageJson.scripts?.dev || '').includes('--experimental-strip-types')) {
  failures.push('server dev script must use Node native TypeScript stripping');
}

if (tsconfig.compilerOptions?.rewriteRelativeImportExtensions !== true) {
  failures.push('tsconfig.json must enable rewriteRelativeImportExtensions');
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (extname(file) === '.ts') await checkFile(file);
  }
}

async function checkFile(file) {
  const source = await readFile(file, 'utf8');
  const importPattern = /(?:from|import\()\s*["'](\.{1,2}\/[^"']+)["']/g;

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    const relativePath = resolve(dirname(file), specifier);

    if (!specifier.endsWith('.ts')) {
      failures.push(`${file}: relative TypeScript import must end in .ts: ${specifier}`);
      continue;
    }

    try {
      await readFile(relativePath, 'utf8');
    } catch {
      failures.push(`${file}: relative import does not resolve: ${specifier}`);
    }
  }
}

await walk(srcRoot);

if (failures.length) {
  console.error('TypeScript runtime check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('TypeScript runtime check passed.');
