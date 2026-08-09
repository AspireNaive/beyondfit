import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Build the Azure App Service deployment artifact.
 *
 * The zip contains exactly three things: `dist/`, `server.js`, and a *minimal*
 * package.json. It deliberately does not ship the real package.json — that
 * lists Vite, TypeScript, oxlint and firebase-tools, and App Service would try
 * to install all of them on every deploy for a server that has no dependencies
 * at all. Shipping a trimmed manifest keeps cold starts fast and the artifact
 * small.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const stage = join(root, '.azure-stage')
const zipPath = join(root, 'azure-deploy.zip')

if (!existsSync(join(dist, 'index.html'))) {
  console.error('No dist/index.html — run `npm run build` first.')
  process.exit(1)
}

rmSync(stage, { recursive: true, force: true })
rmSync(zipPath, { force: true })
mkdirSync(stage, { recursive: true })

cpSync(dist, join(stage, 'dist'), { recursive: true })
cpSync(join(root, 'server.js'), join(stage, 'server.js'))

const { version } = JSON.parse(
  execFileSync('node', ['-p', 'JSON.stringify(require("./package.json"))'], {
    cwd: root,
    encoding: 'utf8',
  }),
)

writeFileSync(
  join(stage, 'package.json'),
  JSON.stringify(
    {
      name: 'beyondfit-web',
      version,
      private: true,
      type: 'module',
      engines: { node: '>=20.19.0' },
      scripts: { start: 'node server.js' },
    },
    null,
    2,
  ) + '\n',
)

// `zip` ships with macOS and every App Service build agent worth using.
execFileSync('zip', ['-r', '-q', zipPath, 'dist', 'server.js', 'package.json'], { cwd: stage })
rmSync(stage, { recursive: true, force: true })

const { size } = await import('node:fs').then((fs) => fs.statSync(zipPath))
console.log(`azure-deploy.zip  ${(size / 1024 / 1024).toFixed(2)} MB`)
