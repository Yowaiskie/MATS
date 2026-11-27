import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isThemeMode,
  parseStoredThemeMode,
  readThemeModeFromCookieString,
  resolveThemeMode
} from '../src/utils/theme.ts'

test('theme utilities', async (t) => {
  await t.test('validates and parses stored theme modes with safe fallback', () => {
    assert.equal(isThemeMode('dark'), true)
    assert.equal(isThemeMode('light'), true)
    assert.equal(isThemeMode('system'), true)
    assert.equal(isThemeMode('midnight'), false)
    assert.equal(isThemeMode(null), false)

    assert.equal(parseStoredThemeMode('dark'), 'dark')
    assert.equal(parseStoredThemeMode('system'), 'system')
    assert.equal(parseStoredThemeMode(undefined), 'light')
    assert.equal(parseStoredThemeMode('invalid'), 'light')
  })

  await t.test('resolves system theme based on OS preference', () => {
    assert.equal(resolveThemeMode('dark', false), 'dark')
    assert.equal(resolveThemeMode('light', true), 'light')
    assert.equal(resolveThemeMode('system', true), 'dark')
    assert.equal(resolveThemeMode('system', false), 'light')
  })

  await t.test('reads mats-theme from cookie string fallback', () => {
    assert.equal(readThemeModeFromCookieString('foo=1; mats-theme=dark; bar=2'), 'dark')
    assert.equal(readThemeModeFromCookieString('mats-theme=system'), 'system')
    assert.equal(readThemeModeFromCookieString('mats-theme=light'), 'light')
    assert.equal(readThemeModeFromCookieString('mats-theme=bogus'), null)
    assert.equal(readThemeModeFromCookieString('other=value'), null)
    assert.equal(readThemeModeFromCookieString(''), null)
  })
})
