/**
 * The standalone desktop layer adds product UI without overriding the shared
 * model adapters or model-configuration surfaces.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

interface PatchRow {
  id?: string
  disabled?: boolean
  config?: Record<string, unknown>
  insert?: PatchRow[]
}

describe('dsh-desktop bundle', () => {
  it('declares a parseable product patch that preserves model configuration', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')

    const parsed = yaml.load(
      readFileSync(resolve(root, manifest.dsh!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    )
    if (!Array.isArray(parsed)) throw new TypeError('desktop patch must parse to a patch list')
    const rows = parsed as PatchRow[]
    const modelRows = new Set([
      'llm-deepseek',
      'llm-pi-ai',
      'session-title-llm',
      'web-search-deepseek',
      'agent-default-model',
      'ui-settings-models',
      'ui-model-selection',
    ])
    for (const id of [
      'llm-deepseek',
      'llm-pi-ai',
      'session-title-llm',
      'web-search-deepseek',
      'ui-settings-models',
      'ui-model-selection',
    ]) {
      expect(rows.find(candidate => candidate.id === id), id).toBeUndefined()
    }
    expect(rows.some(candidate => candidate.id !== undefined && modelRows.has(candidate.id))).toBe(false)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.insert).toEqual([{
      id: 'ui-about',
      name: '@deepseek-ai/dsh-client-ui-about',
    }])
  })
})
