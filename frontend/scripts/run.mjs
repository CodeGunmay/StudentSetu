/**
 * Test launcher. Replaces `node --import ./scripts/register.mjs <file>` so the UI
 * suites run on every Node the project supports, without a flag that only exists
 * on some of them:
 *
 *   node 20.6+ / 18.19+  -> module.register() is here, this file works
 *   node 20.0 – 20.5     -> --import existed but the loader hooks were still
 *                           moving; --loader printed an experimental warning
 *   node < 18.19           -> no register(): the message below says so
 *
 * The version check is the point — a wrong Node should say "upgrade", not throw
 * an ESM stack trace from inside a loader.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/run.mjs <test-file.mjs>');
  process.exit(2);
}
const file = resolve(process.cwd(), target);
if (!existsSync(file)) {
  console.error(`no such test file: ${file}`);
  process.exit(2);
}

/*
 * The live suite is the one case where the launcher has to set a build flag:
 * scripts/jsx-loader.mjs compiles the app into real mode from SETU_API_URL, and
 * loader hooks run on their own thread, so a test cannot set that variable after
 * import — it has to be there before register() below. Nothing else may be
 * touched: smoke.mjs still runs against the mock, exactly as before.
 */
const isLiveSuite = /test-live\.mjs$/.test(file);
const isSessionSuite = /test-session\.mjs$/.test(file);
if (isSessionSuite && !process.env.SETU_API_URL) process.env.SETU_API_URL = 'http://cpp.test'; // a stub origin: this suite replaces fetch itself
if (isLiveSuite && !process.env.SETU_API_URL && !process.env.SETU_CPP_URL) {
  process.env.SETU_API_URL = 'http://localhost:8080'; // the C++ server's own default (PORT, 8080)
  console.log(`[run] no SETU_API_URL — using ${process.env.SETU_API_URL} (the server's default port)\n`);
}

const mod = await import('node:module');
if (typeof mod.register !== 'function') {
  console.error(
    `\nStudentSetu's UI tests need Node 18.19+ or 20.6+ for module.register().\n` +
      `This is Node ${process.versions.node}. Switch with:  nvm install 20 && nvm use 20\n`
  );
  process.exit(2);
}

// the loader compiles .jsx on the fly and forwards import.meta.env, which is how
// a suite can run the app in real mode with no bundler involved
mod.register('./jsx-loader.mjs', pathToFileURL(resolve(process.cwd(), 'scripts') + '/'));

try {
  await import(pathToFileURL(file).href);
} catch (err) {
  if (err && err.code === 'ERR_MODULE_NOT_FOUND' && /esbuild|jsdom|react/.test(String(err.message))) {
    console.error(`\nMissing dependency — run:  npm install\n  (${err.message.split('\n')[0]})\n`);
    process.exit(2);
  }
  throw err;
}
