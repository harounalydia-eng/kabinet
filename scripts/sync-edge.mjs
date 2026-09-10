// Copies the browser platform detector into the `import` edge function so both sides agree on URLs.
import { readFileSync, writeFileSync } from 'node:fs'
const src = readFileSync('src/lib/social/platform.ts', 'utf8')
writeFileSync('supabase/functions/import/platform.ts', `// COPY of src/lib/social/platform.ts for the Deno runtime — keep in sync (npm run sync:edge).\n${src}`)
console.log('supabase/functions/import/platform.ts updated')
