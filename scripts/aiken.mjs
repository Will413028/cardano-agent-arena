import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(`${root}node_modules/.bin/aiken`, process.argv.slice(2), {
  cwd: `${root}validators`, stdio: 'inherit',
});
process.exit(result.status ?? 1);
