import { defineConfig, loadEnv } from 'vite'
import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = dirname(fileURLToPath(import.meta.url))
const root = resolve(frontend, '..')
const home = '/main/HTML/Home/home.html'
function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? htmlFiles(path) : entry.name.endsWith('.html') ? [path] : []
  })
}

export default defineConfig(({ mode }) => ({
  root,
  publicDir: false,
  server: { port: 5173, strictPort: true },
  build: {
    outDir: resolve(frontend, 'dist'),
    emptyOutDir: true,
    rollupOptions: { input: htmlFiles(resolve(root, 'main/HTML')) },
  },
  plugins: [{
    name: 'aair-original-html',
    transformIndexHtml() {
      const apiBase = loadEnv(mode, frontend, 'VITE_').VITE_API_BASE_URL || 'http://localhost:8080/api'
      return [{ tag: 'script', children: `window.AAIR_API_BASE_URL=${JSON.stringify(apiBase).replace(/</g, '\\u003c')};`, injectTo: 'head-prepend' }]
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(302, { Location: home }); res.end(); return
        }
        next()
      })
    },
    closeBundle() {
      const output = resolve(frontend, 'dist')
      for (const directory of ['main/JavaScript', 'main/Style', 'resource']) {
        cpSync(resolve(root, directory), resolve(output, directory), { recursive: true })
      }
      mkdirSync(output, { recursive: true })
      writeFileSync(resolve(output, 'index.html'), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${home}"><a href="${home}">AAIR</a>`)
    },
  }],
}))
