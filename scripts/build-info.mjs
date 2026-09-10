// Build diagnostics for hosting: writes NON-SECRET metadata to dist/build-info.json and the build log.
// Only variable NAMES are recorded, never values. Safe to leave in place.
import { writeFileSync, mkdirSync } from 'node:fs'
const env = process.env
const url = (env.VITE_SUPABASE_URL ?? '').trim()
const info = {
  builtAt: new Date().toISOString(),
  node: process.version,
  vercelEnv: env.VERCEL_ENV ?? null,
  vercel: env.VERCEL === '1',
  gitCommit: (env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || null,
  gitRef: env.VERCEL_GIT_COMMIT_REF ?? null,
  gitRepo: env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG ? `${env.VERCEL_GIT_REPO_OWNER}/${env.VERCEL_GIT_REPO_SLUG}` : null,
  viteKeys: Object.keys(env).filter((k) => k.startsWith('VITE_')).sort(),
  supabaseLikeKeys: Object.keys(env).filter((k) => /supabase/i.test(k)).map((k) => JSON.stringify(k)),
  hasSupabaseUrl: url.length > 0,
  supabaseUrlRawLength: (env.VITE_SUPABASE_URL ?? '').length,
  supabaseUrlDefined: env.VITE_SUPABASE_URL !== undefined,
  supabaseUrlStartsWithHttps: url.startsWith('https://'),
  anonKeyRawLength: (env.VITE_SUPABASE_ANON_KEY ?? '').length,
  supabaseUrlLooksValid: /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url),
}
mkdirSync('dist', { recursive: true })
writeFileSync('dist/build-info.json', JSON.stringify(info, null, 2))
console.log('[build-info]', JSON.stringify(info))
