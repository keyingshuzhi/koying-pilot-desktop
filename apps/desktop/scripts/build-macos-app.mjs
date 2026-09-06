#!/usr/bin/env node

import { chmod, copyFile, cp, mkdir, readFile, rm, symlink } from 'node:fs/promises'
import { existsSync, globSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(appDir, '../..')
const outputRoot = join(root, 'dist-macos')
const productName = '柯影智航'
const infoPlist = await readFile(join(appDir, 'Info.plist'), 'utf8')
const productVersionMatch = infoPlist.match(
  /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
)
if (productVersionMatch === null) throw new Error('desktop Info.plist is missing CFBundleShortVersionString')
const productVersion = productVersionMatch[1].trim()
const product = join(outputRoot, `${productName}.app`)
const legacyProduct = join(outputRoot, 'DeepSeek Harness.app')
const dmgProduct = join(outputRoot, `${productName}-${productVersion}.dmg`)
const contents = join(product, 'Contents')
const resources = join(contents, 'Resources')
const runtime = join(resources, 'runtime')
const staging = join(outputRoot, '.desktop-runtime')
const iconset = join(outputRoot, '.KoyingPilot.iconset')
const dmgRoot = join(outputRoot, '.desktop-dmg-root')
const skipBuild = process.argv.slice(2).includes('--skip-build')

if (process.platform !== 'darwin') throw new Error('desktop build requires macOS')
if (process.argv.slice(2).some(arg => arg !== '--skip-build')) throw new Error('usage: build-macos-app.mjs [--skip-build]')

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) resolveRun()
      else reject(new Error(`${command} failed (${signal ?? `exit ${String(code)}`})`))
    })
  })
}

function capture(command, args, options = {}) {
  return new Promise((resolveCapture, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], ...options })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', text => { stdout += text })
    child.stderr.on('data', text => { stderr += text })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) resolveCapture({ stdout, stderr })
      else reject(new Error(`${command} failed (${signal ?? `exit ${String(code)}`}): ${stderr}`))
    })
  })
}

function runtimeEnvironment(home) {
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => {
    const upper = key.toUpperCase()
    return !upper.includes('KEY') && !upper.includes('SECRET') &&
      !upper.includes('TOKEN') && !upper.includes('PASSWORD')
  }))
  environment.DSH_HOME = home
  environment.DSH_TELEMETRY_DISABLED = '1'
  return environment
}

async function generateIcon() {
  const source = join(appDir, 'assets/koying-pilot-icon.png')
  if (!existsSync(source)) throw new Error('desktop icon source is missing')
  await rm(iconset, { recursive: true, force: true })
  await mkdir(iconset, { recursive: true })
  const variants = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024],
  ]
  try {
    for (const [filename, size] of variants) {
      await run('sips', ['-z', String(size), String(size), source, '--out', join(iconset, filename)])
    }
    await run('iconutil', ['-c', 'icns', iconset, '-o', join(resources, 'KoyingPilot.icns')])
  } finally {
    await rm(iconset, { recursive: true, force: true })
  }
}

async function restoreLegacyHoists(deployRoot) {
  const manifest = JSON.parse(await readFile(join(deployRoot, 'package.json'), 'utf8'))
  const packagePaths = globSync([
    'apps/*/package.json',
    'packages/*/*/package.json',
    'vendor/*/package.json',
  ], { cwd: root })
  const workspace = new Map()
  for (const manifestPath of packagePaths) {
    const candidate = JSON.parse(await readFile(join(root, manifestPath), 'utf8'))
    if (candidate.name !== undefined) workspace.set(candidate.name, dirname(join(root, manifestPath)))
  }

  const restored = []
  for (const dependency of Object.keys(manifest.dependencies ?? {}).sort()) {
    const destination = join(deployRoot, 'node_modules', dependency)
    if (existsSync(destination)) continue
    const source = workspace.get(dependency)
    if (source === undefined) {
      throw new Error(`desktop deploy dependency ${dependency} is missing and has no workspace source`)
    }
    await mkdir(dirname(destination), { recursive: true })
    const nestedNodeModules = join(source, 'node_modules')
    await cp(source, destination, {
      recursive: true,
      dereference: true,
      filter: path => path !== nestedNodeModules && !path.startsWith(nestedNodeModules + sep),
    })
    restored.push(dependency)
  }
  if (restored.length > 0) console.log(`desktop build: restored legacy deploy hoists: ${restored.join(', ')}`)
}

async function verifyModelComposition(node, entry) {
  const verifyHome = join(outputRoot, '.desktop-config-home')
  await rm(verifyHome, { recursive: true, force: true })
  await mkdir(verifyHome, { recursive: true })
  try {
    const { stdout } = await capture(node, [entry, '--profile', 'desktop', '--dump-default-config'], {
      env: runtimeEnvironment(verifyHome),
    })
    const row = id => {
      const start = stdout.indexOf(`- id: ${id}\n`)
      if (start < 0) throw new Error(`desktop composition is missing ${id}`)
      const end = stdout.indexOf('\n- id: ', start + 1)
      return stdout.slice(start, end < 0 ? undefined : end)
    }
    for (const id of [
      'llm-deepseek', 'llm-pi-ai', 'session-title-llm', 'web-search-deepseek',
      'ui-settings-models', 'ui-model-selection',
    ]) {
      if (row(id).includes('disabled: true')) {
        throw new Error(`desktop composition disables required model row ${id}`)
      }
    }
    if (!row('ui-about').includes("name: '@deepseek-ai/dsh-client-ui-about'")) {
      throw new Error('desktop composition is missing the Koying Pilot About page')
    }
  } finally {
    await rm(verifyHome, { recursive: true, force: true })
  }
}

async function smokeRuntime(node, entry) {
  const smokeHome = join(outputRoot, '.desktop-smoke-home')
  await rm(smokeHome, { recursive: true, force: true })
  await mkdir(smokeHome, { recursive: true })

  try {
    await new Promise((resolveSmoke, reject) => {
      const child = spawn(node, [entry, '--profile', 'desktop', '--port', '0'], {
        cwd: root,
        env: runtimeEnvironment(smokeHome),
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stderr = ''
      let ready = false
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGKILL')
      }, 30_000)
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', text => {
        if (!ready && text.includes('dsh web: http://127.0.0.1:')) {
          ready = true
          child.kill('SIGTERM')
        }
      })
      child.stderr.on('data', text => {
        stderr = (stderr + text).slice(-32_768)
      })
      child.on('error', error => {
        clearTimeout(timer)
        reject(error)
      })
      child.on('exit', code => {
        clearTimeout(timer)
        if (ready && code === 0) resolveSmoke()
        else if (timedOut) reject(new Error('desktop runtime smoke timed out before the Web URL became ready'))
        else reject(new Error(`desktop runtime smoke failed (exit ${String(code)}): ${stderr}`))
      })
    })
  } finally {
    await rm(smokeHome, { recursive: true, force: true })
  }
}

async function createDmg() {
  await rm(dmgRoot, { recursive: true, force: true })
  await rm(dmgProduct, { force: true })
  await mkdir(dmgRoot, { recursive: true })
  try {
    await cp(product, join(dmgRoot, basename(product)), { recursive: true, dereference: true })
    await symlink('/Applications', join(dmgRoot, 'Applications'))
    await run('hdiutil', [
      'create', '-volname', productName, '-srcfolder', dmgRoot,
      '-ov', '-format', 'UDZO', dmgProduct,
    ])
  } finally {
    await rm(dmgRoot, { recursive: true, force: true })
  }
}

if (!skipBuild) await run('pnpm', ['run', 'build'])
await run(process.execPath, [
  '--import', 'tsx/esm', 'scripts/verify-runtime-closure.ts',
  '--manifest', 'apps/desktop/package.json',
])
for (const required of ['apps/cli/lib/bin.js', 'apps/web/dist/index.html']) {
  if (!existsSync(join(root, required))) throw new Error(`${required} is missing; run pnpm run build`)
}

await rm(product, { recursive: true, force: true })
await rm(legacyProduct, { recursive: true, force: true })
await rm(staging, { recursive: true, force: true })
await mkdir(outputRoot, { recursive: true })
await run('pnpm', [
  '--filter', '@deepseek-ai/dsh-desktop-app', 'deploy', '--legacy', '--prod',
  '--config.node-linker=hoisted', '--config.auto-install-peers=false',
  '--config.link-workspace-packages=true', staging,
])
await restoreLegacyHoists(staging)

await mkdir(join(contents, 'MacOS'), { recursive: true })
await mkdir(resources, { recursive: true })
await cp(staging, join(runtime, 'app'), { recursive: true, dereference: true })
await copyFile(process.execPath, join(runtime, 'node'))
await copyFile(join(appDir, 'Info.plist'), join(contents, 'Info.plist'))
await generateIcon()
await run('clang', [
  join(appDir, 'native/main.m'), '-O2', '-fobjc-arc', '-framework', 'Cocoa', '-framework', 'WebKit',
  '-o', join(contents, 'MacOS/KoyingPilot'),
])
await chmod(join(runtime, 'node'), 0o755)
await chmod(join(contents, 'MacOS/KoyingPilot'), 0o755)
await run('codesign', ['--force', '--deep', '--sign', '-', product])
await rm(staging, { recursive: true, force: true })

const forbidden = ['settings.yaml', '.credentials.yaml']
const deployedEntry = join(runtime, 'app/node_modules/@deepseek-ai/dsh/lib/bin.js')
const aboutBundle = join(runtime, 'app/node_modules/@deepseek-ai/dsh-client-ui-about/lib/client.js')
if (!existsSync(deployedEntry)) {
  throw new Error('desktop artifact is missing the deployed dsh entry')
}
if (!existsSync(aboutBundle)) {
  throw new Error('desktop artifact is missing the Koying Pilot About client bundle')
}
if (forbidden.some(name => existsSync(join(resources, name)))) {
  throw new Error('desktop artifact unexpectedly contains a user settings or credentials file')
}
if (!existsSync(join(resources, 'KoyingPilot.icns'))) {
  throw new Error('desktop artifact is missing its application icon')
}
await verifyModelComposition(join(runtime, 'node'), deployedEntry)
await smokeRuntime(join(runtime, 'node'), deployedEntry)
await createDmg()

console.log(`desktop app: ${product}`)
console.log(`desktop installer: ${dmgProduct}`)
