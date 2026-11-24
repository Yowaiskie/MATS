import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_EVENT_OPTIONAL_MODULES,
  type EventOptionalModule
} from '../src/types/event.ts'
import {
  getNewlyDisabledModules,
  getResolvedEventModules,
  isEventModuleEnabled
} from '../src/utils/eventModules.ts'

test('eventModules utilities', async (t) => {
  await t.test('keeps all 5 optional modules enabled for legacy events where enabledModules is undefined', () => {
    const resolved = getResolvedEventModules({ enabledModules: undefined })
    assert.deepEqual(resolved, ALL_EVENT_OPTIONAL_MODULES)
    assert.equal(isEventModuleEnabled({ enabledModules: undefined }, 'finance'), true)
    assert.equal(isEventModuleEnabled({ enabledModules: undefined }, 'forms'), true)
    assert.equal(isEventModuleEnabled({ enabledModules: undefined }, 'timeline'), true)
    assert.equal(isEventModuleEnabled({ enabledModules: undefined }, 'requirements'), true)
    assert.equal(isEventModuleEnabled({ enabledModules: undefined }, 'contributions'), true)
  })

  await t.test('keeps all optional modules disabled for new events with empty enabledModules array', () => {
    const resolved = getResolvedEventModules({ enabledModules: [] })
    assert.deepEqual(resolved, [])
    assert.equal(isEventModuleEnabled({ enabledModules: [] }, 'finance'), false)
    assert.equal(isEventModuleEnabled({ enabledModules: [] }, 'forms'), false)
    assert.equal(isEventModuleEnabled({ enabledModules: [] }, 'timeline'), false)
  })

  await t.test('sanitizes duplicates and unknown module keys', () => {
    const dirty = ['forms', 'finance', 'forms', 'unknown_tab'] as unknown as EventOptionalModule[]
    assert.deepEqual(getResolvedEventModules({ enabledModules: dirty }), ['forms', 'finance'])
  })

  await t.test('detects only newly disabled modules when comparing previous and next selections', () => {
    const previous: EventOptionalModule[] = ['timeline', 'finance', 'forms']
    const next: EventOptionalModule[] = ['forms', 'requirements']
    assert.deepEqual(getNewlyDisabledModules(previous, next), ['timeline', 'finance'])
    assert.deepEqual(getNewlyDisabledModules([], ['forms']), [])
  })
})
