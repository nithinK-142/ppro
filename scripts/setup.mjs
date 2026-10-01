import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '..');
const projects = ['server', 'client'];

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

checkNode();

for (const project of projects) {
  ensureEnv(project);
  run(project, ['install', '--frozen-lockfile']);
}

console.log('\nSetup complete.');
