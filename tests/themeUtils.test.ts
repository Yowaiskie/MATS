import test from 'node:test'
import assert from 'node:assert/strict'
import { parseStoredThemeMode, resolveThemeMode } from '../src/utils/theme.ts'

test('theme utilities', async (t) => {
  await t.test('parses valid stored theme modes and falls back to light for invalid values', () => {
    assert.equal(parseStoredThemeMode('light'), 'light')
    assert.equal(parseStoredThemeMode('dark'), 'dark')
    assert.equal(parseStoredThemeMode('system'), 'system')
    assert.equal(parseStoredThemeMode(null), 'light')
    assert.equal(parseStoredThemeMode(undefined), 'light')
    assert.equal(parseStoredThemeMode('invalid'), 'light')
  })

  await t.test('resolves explicit and system theme modes accurately', () => {
    assert.equal(resolveThemeMode('light', true), 'light')
    assert.equal(resolveThemeMode('dark', false), 'dark')
    assert.equal(resolveThemeMode('system', true), 'dark')
    assert.equal(resolveThemeMode('system', false), 'light')
  })
})
