import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(`${root}/${relativePath}`, 'utf8')
}

describe('Windows native desktop distribution', () => {
  it('keeps Web content on loopback and terminates the bundled process tree with the shell', () => {
    const source = read('apps/desktop/native/windows/KoyingPilot.cs')
    expect(source).toContain('uri.Host == "127.0.0.1"')
    expect(source).toContain('uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)')
    expect(source).toContain('JobObjectLimitKillOnJobClose')
    expect(source).toContain('AssignProcessToJobObject(job, process.Handle)')
    for (const credentialName of ['KEY', 'SECRET', 'TOKEN', 'PASSWORD']) {
      expect(source).toContain(`upper.Contains("${credentialName}")`)
    }
  })

  it('builds an x64 per-user installer with selectable protected destination and supplied ICO branding', () => {
    const build = read('apps/desktop/scripts/build-windows-app.mjs')
    const installer = read('apps/desktop/native/windows/Installer.cs')
    expect(build).toContain("const webView2Version = '1.0.4129.50'")
    expect(build).toContain("const webView2Sha256 = 'd3934f482d484b89fb4825df720c710664e1143a1e90f7b3a60794ef33f473d2'")
    expect(build).toContain("'/target:winexe', '/platform:x64'")
    expect(build).toContain("const icon = join(appDir, 'assets', 'koying-pilot-icon.ico')")
    expect(build).not.toContain('async function generateIcon()')
    expect(installer).toContain('Environment.SpecialFolder.LocalApplicationData')
    expect(installer).toContain('FolderBrowserDialog')
    expect(installer).toContain('pathTextBox.Text')
    expect(installer).toContain('InstallationSupport.Install(installDirectory, createDesktopShortcut)')
    expect(installer).toContain('ValidateInstallDirectory(requestedInstallDirectory, previousInstallDirectory)')
    expect(installer).toContain('IsFullyQualifiedPath(requestedDirectory)')
    expect(installer).toContain('PathsOverlap(installDirectory, applicationDataDirectory)')
    expect(installer).toContain('CreateShortSiblingPath(parent, installDirectory, null)')
    expect(installer).toContain('ValidatePayloadDestination(payload, installDirectory)')
    expect(installer).toContain('ExtractPayload(payload, extracted)')
    expect(installer).toContain('请将安装路径缩短到 ')
    expect(installer).toContain('ReadRegisteredInstallDirectory()')
    expect(installer).toContain('!PathsEqual(requested, registeredDirectory)')
    expect(installer).toContain('Registry.CurrentUser.CreateSubKey')
    expect(installer).toContain('private const string PayloadMagic = "KYPZIP01"')
  })
})
