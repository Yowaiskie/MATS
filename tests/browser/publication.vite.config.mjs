import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import baseConfig from '../../vite.config.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))
const originalFirebase = path.resolve(root, 'src/firebase/config.ts')
const fixtureFirebase = path.resolve(root, 'tests/browser/publicationFirebase.ts')

export default defineConfig({
  ...baseConfig,
  root,
  envPrefix: 'PUBLICATION_VERIFY_',
  envDir: path.resolve(root, 'node_modules/.tmp/no-verification-env'),
  cacheDir: path.resolve(root, 'node_modules/.tmp/publication-vite'),
  plugins: [
    {
      name: 'local-publication-emulator-fixture',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source.replace(/\\/g, '/').includes('/firebase/config')) return fixtureFirebase
        if (source === '@/firebase/config' || source === originalFirebase) return fixtureFirebase
        if (importer && source.startsWith('.')) {
          const resolved = path.resolve(path.dirname(importer.split('?')[0]), source)
          if (resolved === originalFirebase || `${resolved}.ts` === originalFirebase) return fixtureFirebase
        }
      }
    },
    ...baseConfig.plugins
  ],
  server: { host: '127.0.0.1', port: 5174, strictPort: true }
})
