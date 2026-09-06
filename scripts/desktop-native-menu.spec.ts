import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = fileURLToPath(new URL('../apps/desktop/native/main.m', import.meta.url))

describe.skipIf(process.platform !== 'darwin')('macOS native menu', () => {
  it('compiles and exposes the standard responder-chain edit shortcuts', () => {
    const compilation = spawnSync('clang', [
      source,
      '-fsyntax-only',
      '-fobjc-arc',
    ], { encoding: 'utf8' })
    expect(compilation.stderr).toBe('')
    expect(compilation.status).toBe(0)

    const nativeSource = readFileSync(source, 'utf8')
    for (const [selector, key] of [
      ['undo:', 'z'],
      ['cut:', 'x'],
      ['copy:', 'c'],
      ['paste:', 'v'],
      ['selectAll:', 'a'],
    ] as const) {
      expect(nativeSource).toContain(`action:@selector(${selector})`)
      expect(nativeSource).toContain(`keyEquivalent:@"${key}"`)
    }
    expect(nativeSource).toContain('action:@selector(redo:)')
    expect(nativeSource).toContain('NSEventModifierFlagCommand | NSEventModifierFlagShift')
  })
})
