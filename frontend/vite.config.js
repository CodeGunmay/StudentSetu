// Connects StudentSetu interface behavior to its application state.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * No /api proxy, and no SETU_API_TARGET.
 *
 * The C++ server owns its own origin — http://localhost:8080 in development (its
 * `PORT` variable, 8080 by default) — and it answers CORS itself on every
 * response, so the dev server must not pretend otherwise: a proxy would hide a
 * missing CORS header during development and the deployed app would then break.
 * Point the app straight at the server with VITE_API_BASE (see .env.example).
 *
 * server/preview bind to 0.0.0.0 and accept any host so the app also works
 * behind a tunnel or a container's preview URL.
 */

/** The placeholder netlify.toml ships with, and anything else that cannot resolve from a browser. */
const PLACEHOLDER = /YOUR-API-HOST|your-api-host|api\.example\.(com|test)/i;
const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;
const isNetlify = () => Boolean(process.env.NETLIFY || process.env.CONTEXT || process.env.DEPLOY_PRIME_URL);

/**
 * A production build must not ship an app whose API origin is a lie.
 *
 * The C++ server is not hosted yet, so netlify.toml deliberately carries
 * `VITE_API_BASE = "https://YOUR-API-HOST"`. Rather than build a bundle that
 * fails in the visitor's Network tab, `vite build` stops here with the sentence
 * that tells you what to change.
 */
function guardRealModeBuild() {
  return {
    name: 'studentsetu:real-mode-guard',
    apply: 'build',
    config(_config, { mode }) {
      const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
      const realMode = String(env.VITE_USE_MOCK ?? '').trim() === 'false';
      if (!realMode) return; // a demo build calls nothing: nothing to guard
      const base = String(env.VITE_API_BASE ?? '').trim();
      const sameOrigin = String(env.VITE_API_SAME_ORIGIN ?? '').trim() === '1';

      if (!base) {
        // an empty base means "call the origin the page came from", which is only
        // true when dist/ is served by the same host that proxies /api to the API
        if (sameOrigin && !isNetlify()) return;
        throw new Error(
          '\nStudentSetu build refused: VITE_USE_MOCK=false but VITE_API_BASE is empty.\n' +
            '  The app would call the origin it is served from — Netlify is not your C++ server.\n' +
            '  Set VITE_API_BASE to the https:// address of the hosted C++ API, then rebuild.\n' +
            (sameOrigin
              ? '  (VITE_API_SAME_ORIGIN=1 is set, but a Netlify build has no /api on its own origin.)\n'
              : '  Serving dist/ beside the API behind one nginx? Set VITE_API_SAME_ORIGIN=1 to say so.\n') +
            '  See DEPLOY.md §1 and §3.\n'
        );
      }
      if (PLACEHOLDER.test(base)) {
        throw new Error(
          `\nStudentSetu build refused: VITE_API_BASE is still the placeholder "${base}".\n` +
            '  The C++ server is not hosted yet — do not build real mode against an address that\n' +
            '  does not resolve. Put the https:// address of the hosted server in netlify.toml\n' +
            '  (or your build environment), then rebuild.\n' +
            '  Until then, leave VITE_USE_MOCK unset: the demo build works on its own.\n' +
            '  See DEPLOY.md §1 and §3.\n'
        );
      }
      if (LOCALHOST.test(base)) {
        const message =
          `  VITE_API_BASE points at "${base}" — that is the visitor's own machine, not your server.\n`;
        if (isNetlify()) {
          throw new Error(`\nStudentSetu build refused: a deployed bundle cannot reach localhost.\n${message}`);
        }
        console.warn(`\n[vite] studentsetu: ${message}  fine for a local preview, wrong for a deploy.\n`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), guardRealModeBuild()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Accept any host so the app works behind the preview proxy
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
});
