import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = resolve(serverRoot, 'src/config/schema.sql');
const destination = resolve(serverRoot, 'dist/config/schema.sql');

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
