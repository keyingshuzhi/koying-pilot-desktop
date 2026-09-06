#!/usr/bin/env node

import {
  copyFile,
  cp,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, globSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(appDir, '../..')
const outputRoot = join(root, 'dist-windows')
const cacheRoot = join(root, '.cache', 'desktop')
const productName = '柯影智航'
const infoPlist = await readFile(join(appDir, 'Info.plist'), 'utf8')
const productVersionMatch = infoPlist.match(
  /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
)
if (productVersionMatch === null) throw new Error('desktop Info.plist is missing CFBundleShortVersionString')
const productVersion = productVersionMatch[1].trim()
const assemblyVersion = /^\d+\.\d+\.\d+$/.test(productVersion)
  ? `${productVersion}.0`
  : null
if (assemblyVersion === null) throw new Error(`desktop product version is not numeric: ${productVersion}`)

const webView2Version = '1.0.4129.50'
const webView2Sha256 = 'd3934f482d484b89fb4825df720c710664e1143a1e90f7b3a60794ef33f473d2'
const webView2Filename = `Microsoft.Web.WebView2.${webView2Version}.nupkg`
const webView2Url = `https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/${webView2Version}`
const product = join(outputRoot, productName)
const installer = join(outputRoot, `${productName}-${productVersion}-win-x64-setup.exe`)
const staging = join(outputRoot, '.desktop-runtime')
const buildRoot = join(outputRoot, '.desktop-build')
const sdkRoot = join(buildRoot, 'webview2-sdk')
const payload = join(buildRoot, 'payload.zip')
const setupStub = join(buildRoot, 'KoyingPilotSetup.stub.exe')
const icon = join(appDir, 'assets', 'koying-pilot-icon.ico')
const skipBuild = process.argv.slice(2).includes('--skip-build')
const pnpm = 'pnpm.cmd'
const pnpmCli = process.env.npm_execpath
const pnpmEnvironment = { ...process.env, CI: process.env.CI ?? 'true' }

if (process.platform !== 'win32') throw new Error('Windows desktop build requires Windows')
if (process.arch !== 'x64') throw new Error('Windows desktop build requires an x64 Node.js process')
if (process.argv.slice(2).some(arg => arg !== '--skip-build')) {
  throw new Error('usage: build-windows-app.mjs [--skip-build]')
}

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

function runPnpm(args) {
  if (pnpmCli !== undefined && existsSync(pnpmCli)) {
    return run(process.execPath, [pnpmCli, ...args], { env: pnpmEnvironment })
  }
  return run(pnpm, args, { shell: true, env: pnpmEnvironment })
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

async function sha256(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function isExpectedSdk(path) {
  return existsSync(path) && await sha256(path) === webView2Sha256
}

async function acquireWebView2Sdk() {
  await mkdir(cacheRoot, { recursive: true })
  const cached = join(cacheRoot, webView2Filename)
  if (await isExpectedSdk(cached)) return cached

  const override = process.env.DSH_WEBVIEW2_NUPKG
  if (override !== undefined) {
    const supplied = resolve(override)
    if (!await isExpectedSdk(supplied)) {
      throw new Error(`DSH_WEBVIEW2_NUPKG must have SHA-256 ${webView2Sha256}`)
    }
    await copyFile(supplied, cached)
    return cached
  }

  const temporaryDownload = join(tmpdir(), webView2Filename)
  if (await isExpectedSdk(temporaryDownload)) {
    await copyFile(temporaryDownload, cached)
    return cached
  }

  const partial = `${cached}.download`
  await rm(partial, { force: true })
  console.log(`desktop build: downloading Microsoft.Web.WebView2 ${webView2Version}`)
  const response = await fetch(webView2Url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`WebView2 SDK download failed: HTTP ${response.status}`)
  await writeFile(partial, Buffer.from(await response.arrayBuffer()))
  if (!await isExpectedSdk(partial)) {
    await rm(partial, { force: true })
    throw new Error(`WebView2 SDK SHA-256 does not match ${webView2Sha256}`)
  }
  await rename(partial, cached)
  return cached
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
      const normalized = stdout.replaceAll('\r\n', '\n')
      const start = normalized.indexOf(`- id: ${id}\n`)
      if (start < 0) throw new Error(`desktop composition is missing ${id}`)
      const end = normalized.indexOf('\n- id: ', start + 1)
      return normalized.slice(start, end < 0 ? undefined : end)
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
        child.kill()
      }, 30_000)
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', text => {
        if (!ready && text.includes(ReadyMarker)) {
          ready = true
          child.kill()
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
        if (ready) resolveSmoke()
        else if (timedOut) reject(new Error('desktop runtime smoke timed out before the Web URL became ready'))
        else reject(new Error(`desktop runtime smoke failed (exit ${String(code)}): ${stderr}`))
      })
    })
  } finally {
    await rm(smokeHome, { recursive: true, force: true })
  }
}

const ReadyMarker = 'dsh web: http://127.0.0.1:'

async function compileNativeShell(sdk) {
  const windowsSource = join(appDir, 'native', 'windows')
  const framework = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319')
  const csc = join(framework, 'csc.exe')
  if (!existsSync(csc)) throw new Error(`.NET Framework x64 compiler is missing: ${csc}`)
  const webViewLib = join(sdk, 'lib', 'net462')
  const buildInfo = join(buildRoot, 'BuildInfo.cs')
  await writeFile(buildInfo, [
    'using System.Reflection;',
    `[assembly: AssemblyTitle("Koying Pilot")]`,
    `[assembly: AssemblyProduct("Koying Pilot")]`,
    `[assembly: AssemblyCompany("Koying Digital Intelligence")]`,
    `[assembly: AssemblyCopyright("Copyright © 2026 Koying Digital Intelligence")]`,
    `[assembly: AssemblyVersion("${assemblyVersion}")]`,
    `[assembly: AssemblyFileVersion("${assemblyVersion}")]`,
    `[assembly: AssemblyInformationalVersion("${productVersion}")]`,
    'namespace KoyingPilot.Desktop {',
    `    internal static class BuildInfo { internal const string ProductVersion = "${productVersion}"; }`,
    '}',
    '',
  ].join('\n'))

  const common = [
    '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/debug-',
    `/win32icon:${icon}`,
    `/reference:${join(framework, 'System.dll')}`,
    `/reference:${join(framework, 'System.Core.dll')}`,
    `/reference:${join(framework, 'System.Drawing.dll')}`,
    `/reference:${join(framework, 'System.Windows.Forms.dll')}`,
  ]
  await run(csc, [
    ...common,
    `/out:${join(product, 'KoyingPilot.exe')}`,
    `/win32manifest:${join(windowsSource, 'KoyingPilot.exe.manifest')}`,
    `/reference:${join(webViewLib, 'Microsoft.Web.WebView2.Core.dll')}`,
    `/reference:${join(webViewLib, 'Microsoft.Web.WebView2.WinForms.dll')}`,
    join(windowsSource, 'KoyingPilot.cs'),
    buildInfo,
  ])
  await copyFile(join(windowsSource, 'KoyingPilot.exe.config'), join(product, 'KoyingPilot.exe.config'))
  for (const dependency of ['Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll']) {
    await copyFile(join(webViewLib, dependency), join(product, dependency))
  }
  await copyFile(
    join(sdk, 'runtimes', 'win-x64', 'native', 'WebView2Loader.dll'),
    join(product, 'WebView2Loader.dll'),
  )

  const installerReferences = [
    ...common,
    `/win32manifest:${join(windowsSource, 'Installer.exe.manifest')}`,
    `/reference:${join(framework, 'System.IO.Compression.dll')}`,
    `/reference:${join(framework, 'System.IO.Compression.FileSystem.dll')}`,
  ]
  await run(csc, [
    ...installerReferences,
    '/define:UNINSTALLER',
    `/out:${join(product, 'Uninstall.exe')}`,
    join(windowsSource, 'Installer.cs'),
    buildInfo,
  ])
  await run(csc, [
    ...installerReferences,
    `/out:${setupStub}`,
    join(windowsSource, 'Installer.cs'),
    buildInfo,
  ])
}

async function createInstaller() {
  await rm(payload, { force: true })
  await rm(installer, { force: true })
  await run('tar.exe', ['-a', '-cf', payload, '-C', product, '.'])
  await copyFile(setupStub, installer)
  const output = await open(installer, 'a')
  try {
    for await (const chunk of createReadStream(payload)) await output.write(chunk)
    const payloadStat = await stat(payload)
    const trailer = Buffer.alloc(16)
    trailer.writeBigInt64LE(BigInt(payloadStat.size), 0)
    trailer.write('KYPZIP01', 8, 'ascii')
    await output.write(trailer)
  } finally {
    await output.close()
  }
}

if (!skipBuild) await runPnpm(['run', 'build'])
await run(process.execPath, [
  '--import', 'tsx/esm', 'scripts/verify-runtime-closure.ts',
  '--manifest', 'apps/desktop/package.json',
])
for (const required of ['apps/cli/lib/bin.js', 'apps/web/dist/index.html']) {
  if (!existsSync(join(root, required))) throw new Error(`${required} is missing; run pnpm run build`)
}

await rm(product, { recursive: true, force: true })
await rm(staging, { recursive: true, force: true })
await rm(buildRoot, { recursive: true, force: true })
await mkdir(product, { recursive: true })
await mkdir(buildRoot, { recursive: true })

const webView2Package = await acquireWebView2Sdk()
await mkdir(sdkRoot, { recursive: true })
await run('tar.exe', ['-xf', webView2Package, '-C', sdkRoot])
await runPnpm([
  '--filter', '@deepseek-ai/dsh-desktop-app', 'deploy', '--legacy', '--prod',
  '--config.node-linker=hoisted', '--config.auto-install-peers=false',
  '--config.link-workspace-packages=true', staging,
])
await restoreLegacyHoists(staging)

await mkdir(join(product, 'runtime'), { recursive: true })
await cp(staging, join(product, 'runtime', 'app'), { recursive: true, dereference: true })
await copyFile(process.execPath, join(product, 'runtime', 'node.exe'))
await compileNativeShell(sdkRoot)
await rm(staging, { recursive: true, force: true })

const deployedEntry = join(product, 'runtime', 'app', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
const aboutBundle = join(
  product,
  'runtime',
  'app',
  'node_modules',
  '@deepseek-ai',
  'dsh-client-ui-about',
  'lib',
  'client.js',
)
for (const required of [
  join(product, 'KoyingPilot.exe'),
  join(product, 'Uninstall.exe'),
  join(product, 'WebView2Loader.dll'),
  join(product, 'runtime', 'node.exe'),
  deployedEntry,
  aboutBundle,
]) {
  if (!existsSync(required)) throw new Error(`desktop artifact is missing ${required}`)
}
for (const forbidden of ['settings.yaml', '.credentials.yaml']) {
  if (existsSync(join(product, forbidden))) {
    throw new Error(`desktop artifact unexpectedly contains ${forbidden}`)
  }
}

await verifyModelComposition(join(product, 'runtime', 'node.exe'), deployedEntry)
await smokeRuntime(join(product, 'runtime', 'node.exe'), deployedEntry)
await run(join(product, 'KoyingPilot.exe'), ['--check-webview2'])
await createInstaller()
await run(installer, ['--verify'])
await rm(buildRoot, { recursive: true, force: true })

console.log(`desktop app: ${product}`)
console.log(`desktop installer: ${installer}`)
