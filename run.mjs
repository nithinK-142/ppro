import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname);
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

function packageManagerVersion(projectDir) {
  const packageJson = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));
  const configured = packageJson.packageManager;
  if (!configured?.startsWith('pnpm@')) {
    fail(`${projectDir}/package.json must define an exact pnpm version.`);
  }
  return configured.slice('pnpm@'.length);
}

function runVersion(command) {
  return spawnSync(command, ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32',
  });
}

function getRunner(projectDir) {
  const version = packageManagerVersion(projectDir);
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const corepack = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  const installed = runVersion(pnpm);
  if (installed.status === 0 && installed.stdout.trim() === version) {
    return { command: pnpm, prefix: [] };
  }
  if (runVersion(corepack).status === 0) return { command: corepack, prefix: ['pnpm'] };
  if (runVersion(npm).status === 0) {
    return { command: npm, prefix: ['exec', '--yes', `pnpm@${version}`, '--'] };
  }

  fail('Node.js is installed, but pnpm, Corepack, and npm are unavailable.');
}

function run(project, args) {
  const projectDir = join(repoRoot, project);
  const { command, prefix } = getRunner(projectDir);
  console.log(`[${project}] ${[command, ...prefix, ...args].join(' ')}`);

  const result = spawnSync(command, [...prefix, ...args], {
    cwd: projectDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

function ensureEnv(project) {
  const projectDir = join(repoRoot, project);
  const example = join(projectDir, '.env.example');
  const envFile = join(projectDir, '.env');

  if (!existsSync(example)) fail(`${project}/.env.example is missing.`);
  if (existsSync(envFile)) {
    console.log(`[${project}] .env already exists; leaving it unchanged`);
    return;
  }

  writeFileSync(envFile, readFileSync(example, 'utf8'));
  console.log(`[${project}] created .env`);
}

function needsInstall() {
  return projects.some(({ name }) => !existsSync(join(repoRoot, name, 'node_modules')));
}

checkNode();

for (const project of projects) ensureEnv(project.name);

const clientEnv = join(repoRoot, 'client', '.env');
if (existsSync(clientEnv) && readFileSync(clientEnv, 'utf8').includes('YOUR_LAN_IP')) {
  fail('Set EXPO_PUBLIC_API_URL in client/.env to your LAN IP (see README), then run again.');
}

if (needsInstall()) {
  console.log('\n[setup] installing both projects...\n');
  for (const project of projects) run(project.name, ['install', '--frozen-lockfile']);
  console.log('\nSetup complete.');
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
  const { command, prefix } = getRunner(join(repoRoot, name));
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
