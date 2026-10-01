import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [, , project, ...args] = process.argv;
if (!project || !['server', 'client'].includes(project) || args.length === 0) {
  console.error('Usage: node scripts/run.mjs <server|client> <command> [args...]');
  process.exit(1);
}

const repoRoot = resolve(import.meta.dirname, '..');
const projectDir = join(repoRoot, project);
const packageJsonPath = join(projectDir, 'package.json');
if (!existsSync(packageJsonPath)) {
  console.error(`Error: ${project}/package.json is missing.`);
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const configured = packageJson.packageManager;
if (!configured?.startsWith('pnpm@')) {
  console.error(`Error: ${project}/package.json must define an exact pnpm version.`);
  process.exit(1);
}

const version = configured.slice('pnpm@'.length);
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const corepack = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function getInstalledVersion(command) {
  const result = spawnSync(command, ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

let command;
let prefix;
if (getInstalledVersion(pnpm) === version) {
  command = pnpm;
  prefix = [];
} else if (getInstalledVersion(corepack)) {
  command = corepack;
  prefix = ['pnpm'];
} else if (getInstalledVersion(npm)) {
  command = npm;
  prefix = ['exec', '--yes', `pnpm@${version}`, '--'];
} else {
  console.error('Error: pnpm, Corepack, or npm is required.');
  process.exit(1);
}

const result = spawnSync(command, [...prefix, ...args], {
  cwd: projectDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
