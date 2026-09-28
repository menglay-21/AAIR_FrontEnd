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

test('a feature 401 does not log out a user whose AAIR session is still valid', async () => {
  const dom = new JSDOM('', { url: 'http://localhost:5173/main/HTML/User/AILabeling/Task.html?id=4', runScripts: 'outside-only' })
  const w = dom.window
  w.Headers = Headers
  w.sessionStorage.setItem('aair_access_token', 'valid-session-token')
  w.localStorage.setItem('aair_access_token', 'valid-session-token')
  const paths = []
  w.fetch = async (url) => {
    const path = new URL(url).pathname
    paths.push(path)
    if (path === '/api/auth/me') {
      return { ok: true, status: 200, json: async () => ({ success: true, data: { id: 10, username: 'ai_labeler01', role: 'AI_LABELER' } }) }
    }
    return { ok: false, status: 401, json: async () => ({ message: 'Nhà cung cấp AI từ chối API key.' }) }
  }
  w.eval(source)

  await assert.rejects(
    w.AAIR.request('/tasks/4/run-ai', { method: 'POST', json: { provider: 'Gemini' } }),
    /Nhà cung cấp AI/,
  )
  assert.deepEqual(paths, ['/api/tasks/4/run-ai', '/api/auth/me'])
  assert.equal(w.sessionStorage.getItem('aair_access_token'), 'valid-session-token')
  assert.equal(w.localStorage.getItem('aair_access_token'), 'valid-session-token')
  dom.window.close()
})

test('an optional API 401 keeps the session for fallback data', async () => {
  const dom = new JSDOM('', { url: 'http://localhost:5173/main/HTML/User/ResultAnalysis/Task.html', runScripts: 'outside-only' })
  const w = dom.window
  w.Headers = Headers
  w.sessionStorage.setItem('aair_access_token', 'session-token')
  w.localStorage.setItem('aair_access_token', 'session-token')
  w.fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) })
  w.eval(source)

  await assert.rejects(w.AAIR.request('/tasks/7/ai-results', { suppressAuthRedirect: true }), /Unauthorized/)
  assert.equal(w.sessionStorage.getItem('aair_access_token'), 'session-token')
  assert.equal(w.localStorage.getItem('aair_access_token'), 'session-token')
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

test('AI labeler task reuses the cached login user without an extra auth redirect', async () => {
  const dom = new JSDOM('', { url: 'http://localhost:5173/main/HTML/User/AILabeling/Task.html?id=4', runScripts: 'outside-only' })
  const w = dom.window
  w.Headers = Headers
  w.localStorage.setItem('aair_access_token', 'persistent-token')
  w.localStorage.setItem('aair_user', JSON.stringify({ id: 4, username: 'ai_labeler01', role: 'AI_LABELER' }))
  let requests = 0
  w.fetch = async () => { requests += 1; return { ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) } }
  w.eval(source)

  const user = await w.AAIR.guard()
  assert.equal(user.role, 'AI_LABELER')
  assert.equal(requests, 0)
  assert.equal(w.sessionStorage.getItem('aair_access_token'), 'persistent-token')
  dom.window.close()
})

test('cached user cannot bypass the role directory check', async () => {
  const dom = new JSDOM('', { url: 'http://localhost:5173/main/HTML/User/AILabeling/Task.html?id=4', runScripts: 'outside-only' })
  const w = dom.window
  w.Headers = Headers
  w.localStorage.setItem('aair_access_token', 'persistent-token')
  w.localStorage.setItem('aair_user', JSON.stringify({ id: 7, username: 'reviewer01', role: 'REVIEWER' }))
  w.fetch = async (_url, init) => {
    assert.equal(init.headers.get('Authorization'), 'Bearer persistent-token')
    return { ok: true, status: 200, json: async () => ({ success: true, data: { id: 7, username: 'reviewer01', role: 'REVIEWER' } }) }
  }
  w.eval(source)

  const user = await w.AAIR.guard()
  assert.equal(user, null)
  assert.equal(w.localStorage.getItem('aair_access_token'), 'persistent-token')
  dom.window.close()
})
