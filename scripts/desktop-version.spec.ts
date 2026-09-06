import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(`${root}/${relativePath}`, 'utf8')
}

describe('desktop product version', () => {
  it('keeps the bundle metadata, About page, and installer documentation aligned', () => {
    const infoPlist = read('apps/desktop/Info.plist')
    const match = infoPlist.match(
      /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
    )
    expect(match?.[1]).toBe('0.1.1')

    const aboutCopy = read('packages/client/ui-about/src/client/locales.ts')
    expect(aboutCopy.match(/version: '0\.1\.1'/g)).toHaveLength(2)
    expect(read('apps/desktop/README.md')).toContain('柯影智航-0.1.1.dmg')
    expect(read('apps/desktop/README.zh.md')).toContain('柯影智航-0.1.1.dmg')
    expect(read('apps/desktop/README.md')).toContain('柯影智航-0.1.1-win-x64-setup.exe')
    expect(read('apps/desktop/README.zh.md')).toContain('柯影智航-0.1.1-win-x64-setup.exe')
  })
})
