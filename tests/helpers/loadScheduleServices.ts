import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)

// Execute actual service source in the Node realm. Inject only the Firebase
// boundary, so this works with both optimistic mocks and real emulator SDKs.
export function loadScheduleServices(firestore: object, db: unknown) {
  const modules = new Map<string, { exports: unknown }>()
  function load<T>(relative: string): T {
    const filename = path.resolve(relative)
    if (modules.has(filename)) return modules.get(filename)!.exports as T
    const module = { exports: {} }
    modules.set(filename, module)
    const localRequire = (name: string): unknown => {
      if (name === 'firebase/firestore') return firestore
      if (name.includes('firebase/config')) return { db }
      if (name.includes('auditService')) return { auditService: { logAction: async () => 'test-audit' } }
      if (name.includes('settingsService')) return { settingsService: { getOrderRotationSettings: async () => ({}) } }
      if (name.includes('memberService')) return { memberService: { getMembers: async () => [] } }
      if (name.includes('orderRotationService')) return { orderRotationService: {} }
      if (name.startsWith('.') || name.startsWith('@/')) {
        let target = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(filename), name)
        if (!target.endsWith('.ts')) target += '.ts'
        return load(target)
      }
      return require(name)
    }
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
    return module.exports as T
  }
  return {
    integrity: load<typeof import('../../src/services/scheduleIntegrityService.ts')>('src/services/scheduleIntegrityService.ts'),
    publications: load<typeof import('../../src/services/publicationService.ts')>('src/services/publicationService.ts').publicationService,
    recurring: load<typeof import('../../src/services/recurringService.ts')>('src/services/recurringService.ts').recurringService
  }
}
