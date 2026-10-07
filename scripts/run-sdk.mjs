import { spawn } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptName = process.argv[2];
if (!['pay.mjs', 'plasma.mjs', 'oft.mjs'].includes(scriptName)) {
  throw new Error('Specify pay.mjs, plasma.mjs, or oft.mjs');
}
let temporaryDir;
let entryPoint = join(projectDir, 'scripts', scriptName);

// TACEO's current Merces client uses URL.pathname for local WASM files.
// That produces a percent-encoded, non-existent path in a Unicode directory.
if (/[^\x00-\x7f]/.test(projectDir)) {
  temporaryDir = await mkdtemp(join(tmpdir(), 'taceo-lab-'));
  const alias = join(temporaryDir, 'project');
  await symlink(projectDir, alias, 'dir');
  entryPoint = join(alias, 'scripts', scriptName);
}

const child = spawn(process.execPath, [
  '--preserve-symlinks',
  '--preserve-symlinks-main',
  ...(scriptName === 'plasma.mjs' ? ['--import', 'tsx/esm'] : []),
  entryPoint,
  ...process.argv.slice(3),
], { stdio: 'inherit' });

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve(signal ? 1 : code ?? 1));
});
if (temporaryDir) await rm(temporaryDir, { recursive: true, force: true });
process.exitCode = exitCode;
