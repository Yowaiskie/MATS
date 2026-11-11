import { fileURLToPath } from 'node:url'
import config from './publication.vite.config.mjs'

const fixtureFirebase = fileURLToPath(new URL('./publicSubmissionFirebase.ts', import.meta.url))
export default {
  ...config,
  cacheDir: 'node_modules/.tmp/public-submission-vite',
  plugins: config.plugins.map(plugin => plugin?.name === 'local-publication-emulator-fixture' ? {
    ...plugin,
    resolveId(source) {
      if (source.replace(/\\/g, '/').includes('/firebase/config')) return fixtureFirebase
    }
  } : plugin),
  server: { host: '127.0.0.1', port: 5175, strictPort: true }
}
