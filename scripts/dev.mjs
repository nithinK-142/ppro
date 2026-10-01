import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '..');
const projects = [
  { name: 'server', command: ['dev'] },
  { name: 'client', command: ['start'] },
];

function fail(message) {
  console.error(`\nError: ${message}`);
  process.exit(1);
}

function checkNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (!Number.isInteger(major) || major < 22 || (major === 22 && minor < 13)) {
    fail(`Node.js 22.13.0 or newer is required. Found ${process.version}.`);
  }
}

function getRunner(project) {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, project, 'package.json'), 'utf8'));
  const configured = packageJson.packageManager;
  if (!configured?.startsWith('pnpm@')) fail(`${project}/package.json must define an exact pnpm version.`);

  const version = configured.slice('pnpm@'.length);
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const corepack = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  const versionResult = (command) => spawnSync(command, ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32',
  });

  if (versionResult(pnpm).status === 0 && versionResult(pnpm).stdout.trim() === version) {
    return { command: pnpm, prefix: [] };
  }
  if (versionResult(corepack).status === 0) return { command: corepack, prefix: ['pnpm'] };
  if (versionResult(npm).status === 0) return { command: npm, prefix: ['exec', '--yes', `pnpm@${version}`, '--'] };

  fail('Node.js is installed, but pnpm, Corepack, and npm are unavailable.');
}

function needsSetup() {
  return projects.some(({ name }) => !existsSync(join(repoRoot, name, 'node_modules')) || !existsSync(join(repoRoot, name, '.env')));
}

checkNode();

if (needsSetup()) {
  console.log('[setup] first run detected; preparing both projects...\n');
  const result = spawnSync(process.execPath, [join(repoRoot, 'scripts/setup.mjs')], { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const children = [];
let shuttingDown = false;

function stopChild(child) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }
  if (!child.killed) child.kill('SIGTERM');
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stopChild(child);
  setTimeout(() => process.exit(code), 500);
}

function startProject({ name, command: args }) {
  const { command, prefix } = getRunner(name);
  console.log(`[${name}] starting...`);

  const child = spawn(command, [...prefix, ...args], {
    cwd: join(repoRoot, name),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  children.push(child);
  child.on('error', (error) => {
    console.error(`[${name}] ${error.message}`);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (signal || code !== 0) {
      console.error(`[${name}] stopped${signal ? ` by ${signal}` : ` with code ${code}`}`);
      shutdown(code ?? 1);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

for (const project of projects) startProject(project);

console.log('\nPadosiPro is running.');
console.log('API: http://localhost:4000');
console.log('Expo: see Metro output above');
console.log('Press Ctrl+C to stop both.');
