const { spawn, spawnSync } = require('node:child_process');
const { existsSync, readFileSync, openSync, closeSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { parseEnv } = require('node:util');
const net = require('node:net');

const root = resolve(__dirname, '..');
const serverRoot = join(root, 'server');
const background = process.argv.includes('--background');
const children = [];
const envPath = join(serverRoot, '.env');
const config = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const apiPort = Number(process.env.PORT || config.PORT || 3001);
const apiUrl = `http://127.0.0.1:${apiPort}/api/health`;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function listening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

async function healthy() {
  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok && (await response.json()).status === 'ok';
  } catch {
    return false;
  }
}

// #explain_notes: Background mode keeps the local demo running after this terminal closes.
function launch(name, args, cwd) {
  if (background && process.platform === 'win32') {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        join(root, 'scripts', 'start-worker.ps1'),
        '-Worker',
        name,
        '-NodePath',
        process.execPath,
      ],
      { cwd: root, windowsHide: true, stdio: 'ignore' },
    );
    if (result.error || result.status !== 0) {
      throw new Error(
        `Could not start ${name} in the background. Check its installation and configuration.`,
      );
    }
    return;
  }
  const log = background ? openSync(join(serverRoot, `${name}-dev.log`), 'a') : null;
  const child = spawn(process.execPath, args, {
    cwd,
    detached: background,
    windowsHide: true,
    stdio: background ? ['ignore', log, log] : 'inherit',
  });
  child.on('error', () => {
    console.error(`Could not start ${name}. Check its installation and configuration.`);
    process.exitCode = 1;
  });
  if (background) {
    child.unref();
    closeSync(log);
  } else {
    children.push(child);
    child.once('exit', (code) => {
      if (code) process.exitCode = code;
      for (const other of children) if (other !== child) other.kill();
    });
  }
}

async function main() {
  // #explain_notes: Windows background workers must be independent of the
  // launching terminal's process group so they survive its shutdown.
  if (background && process.platform === 'win32' && !process.argv.includes('--independent')) {
    if (!(await healthy()) || !(await listening(5173))) {
      const result = spawnSync('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        join(root, 'scripts', 'start-independent.ps1'), '-NodePath', process.execPath,
      ], { windowsHide: true, stdio: 'ignore' });
      if (result.error || result.status !== 0) {
        throw new Error('Could not start the independent background launcher.');
      }
      let ready = false;
      for (let attempt = 0; attempt < 120; attempt++) {
        if (await healthy() && await listening(5173)) { ready = true; break; }
        await pause(250);
      }
      if (!ready) throw new Error('Background startup did not finish. Check the local API and database logs.');
    }
    console.log('TripNest is ready in the background: http://127.0.0.1:5173/services');
    return;
  }
  // Use the bundled database only when this project is configured for that instance.
  const databaseUrl = process.env.DATABASE_URL || config.DATABASE_URL;
  const database = databaseUrl ? new URL(databaseUrl) : null;
  if (
    database &&
    ['127.0.0.1', 'localhost'].includes(database.hostname) &&
    database.port === '5433' &&
    existsSync(join(serverRoot, '.local', 'pgsql', 'bin', 'postgres.exe'))
  ) {
    const result = spawnSync(process.execPath, ['scripts/start-db.js'], {
      cwd: serverRoot,
      windowsHide: true,
      stdio: 'inherit',
    });
    if (result.status !== 0) throw new Error('The local database could not start.');
  }

  if (!(await healthy())) {
    if (await listening(apiPort)) {
      throw new Error(
        `Port ${apiPort} is occupied or the database is unavailable. Check the API and database before retrying.`,
      );
    }
    const args = ['--env-file-if-exists=.env', 'src/index.js'];
    if (!background) args.unshift('--watch');
    launch('api', args, serverRoot);
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await healthy()) {
        ready = true;
        break;
      }
      await pause(250);
    }
    if (!ready)
      throw new Error(
        'The API did not become ready. Check server/api-dev.log and the database configuration.',
      );
  }

  if (!(await listening(5173))) {
    launch(
      'web',
      [
        'node_modules/vite/bin/vite.js',
        '--host',
        '127.0.0.1',
        '--port',
        '5173',
        '--strictPort',
      ],
      join(root, 'client'),
    );
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await listening(5173)) break;
      await pause(250);
    }
    if (!(await listening(5173)))
      throw new Error('The web preview did not start. Check server/web-dev.log.');
  }
  console.log('TripNest is ready: http://127.0.0.1:5173/services');
}

// Stop only workers started by this foreground command, keeping existing previews intact.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) child.kill();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error.message);
  for (const child of children) child.kill();
  process.exitCode = 1;
});
