import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

test('getGreeting respects every time boundary', async () => {
  const dom = new JSDOM('<h2 data-greeting></h2>', { runScripts: 'outside-only' })
  dom.window.setInterval = () => 0
  dom.window.eval(readFileSync(new URL('../../main/JavaScript/greeting.js', import.meta.url), 'utf8'))
  const getGreeting = dom.window.AAIRGreeting.getGreeting
  for (const [time, expected] of [
    ['00:00', 'Good Evening,'], ['00:01', 'Good Morning,'], ['12:00', 'Good Morning,'],
    ['12:01', 'Good Afternoon,'], ['18:00', 'Good Afternoon,'], ['18:01', 'Good Evening,'],
    ['23:59', 'Good Evening,'],
  ]) assert.equal(getGreeting(new Date(`2026-10-04T${time}:00`)), expected)
  dom.window.close()
})
