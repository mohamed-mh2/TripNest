import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const binary = join(root, '.local', 'pgsql', 'bin', 'pg_ctl.exe');
const ready = () =>
  spawnSync(
    join(root, '.local', 'pgsql', 'bin', 'pg_isready.exe'),
    ['-h', '127.0.0.1', '-p', '5433', '-q'],
    { windowsHide: true },
  ).status === 0;

if (!existsSync(binary)) {
  throw new Error(
    'Local PostgreSQL runtime is missing. Install PostgreSQL and set DATABASE_URL for your instance.',
  );
}

if (ready()) {
  console.log('PostgreSQL already running on port 5433.');
} else {
  // #explain_notes: pg_ctl manages PostgreSQL as a background server, rather
  // than attaching its workers to the terminal that launched the demo.
  const result = spawnSync(
    binary,
    [
      'start',
      '-D',
      join(root, '.local', 'data'),
      '-l',
      join(root, '.local', 'postgres-server.log'),
      '-o',
      '-p 5433 -h 127.0.0.1',
      '-w',
      '-t',
      '30',
    ],
    { cwd: root, windowsHide: true, stdio: 'ignore' },
  );

  if (result.error || result.status !== 0 || !ready()) {
    throw new Error(
      'PostgreSQL did not become ready. Check server/.local/postgres-server.log.',
    );
  }
  console.log('PostgreSQL ready on 127.0.0.1:5433.');
}
