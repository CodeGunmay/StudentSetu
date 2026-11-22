/** Node ESM loader: lets the smoke test import the app's .jsx sources directly. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const EXTS = ['.jsx', '.js'];
const INDEXES = ['/index.jsx', '/index.js'];

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    try {
      return await next(specifier, context);
    } catch (err) {
      for (const suffix of [...EXTS, ...INDEXES]) {
        try {
          return await next(specifier + suffix, context);
        } catch {
          /* keep looking */
        }
      }
      throw err;
    }
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (!/\.(jsx|js|mjs)$/.test(url)) return next(url, context);
  const path = fileURLToPath(url);
  if (path.includes('node_modules')) return next(url, context);
  const source = readFileSync(path, 'utf8');
  // SETU_API_URL makes the app run against a live REST server instead of the
  // mock: the api module reads USE_MOCK / BASE_URL from import.meta.env, so the
  // define has to reach plain .js files too — not only ones holding JSX.
  const define = process.env.SETU_API_URL
    ? {
        'import.meta.env': JSON.stringify({
          VITE_USE_MOCK: 'false',
          VITE_API_BASE: process.env.SETU_API_URL,
          // a live suite reads once and asserts; a 15 s timer firing after the test
          // stopped wrapping updates in act() only produces warnings, so it is off
          // unless the run asks for it
          VITE_POLL_MS: process.env.SETU_POLL_MS || '0',
        }),
      }
    : {};
  const hasJsx = /\.jsx$/.test(path) || /<[A-Za-z]/.test(source);
  if (!hasJsx && !Object.keys(define).length) return next(url, context);
  const { code } = transformSync(source, {
    loader: hasJsx ? 'jsx' : 'js',
    jsx: 'automatic',
    format: 'esm',
    target: 'node20',
    define,
  });
  return { format: 'module', source: code, shortCircuit: true };
}
