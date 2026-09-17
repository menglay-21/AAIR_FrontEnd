import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'

const root = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(root, 'main/JavaScript/api.js'), 'utf8')

test('an API 401 clears the session and redirects to login', async () => {
  const dom = new JSDOM('', { url: 'http://localhost:5173/main/HTML/User/AILabeling/Task.html', runScripts: 'outside-only' })
  const w = dom.window
  w.Headers = Headers
  w.sessionStorage.setItem('aair_access_token', 'session-token')
  w.localStorage.setItem('aair_access_token', 'session-token')
  w.fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) })
  w.eval(source)

  await assert.rejects(w.AAIR.request('/documents/1/file', { blob: true }), /Unauthorized/)
  assert.equal(w.sessionStorage.getItem('aair_access_token'), null)
  assert.equal(w.localStorage.getItem('aair_access_token'), null)
  dom.window.close()
})

test('API client restores the page session from the persistent login token', async () => {
  const dom = new JSDOM('', { url: 'http://localhost:5173/main/HTML/User/AILabeling/Prompt.html', runScripts: 'outside-only' })
  const w = dom.window
  w.Headers = Headers
  w.localStorage.setItem('aair_access_token', 'persistent-token')
  w.fetch = async (_url, init) => {
    assert.equal(init.headers.get('Authorization'), 'Bearer persistent-token')
    return { ok: true, status: 200, json: async () => ({ success: true, data: { id: 1, username: 'yes', role: 'AI_LABELER' } }) }
  }
  w.eval(source)

  const user = await w.AAIR.guard()
  assert.equal(user.role, 'AI_LABELER')
  assert.equal(w.sessionStorage.getItem('aair_access_token'), 'persistent-token')
  dom.window.close()
})
