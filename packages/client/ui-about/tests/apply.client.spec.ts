// @vitest-environment jsdom
/** About-page registration, localization, product identity, slot-order independence, and disposal. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '../src/client/index.ts'
import { AboutSection } from '../src/client/AboutSection.tsx'
import type { AboutSectionInjected } from '../src/client/AboutSection.tsx'

usePinnedBrowserLanguages('zh-CN')

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-about apply', () => {
  it('registers after either activation order, follows locale, recovers, and disposes', async () => {
    expect(inject).toEqual(['slots', 'locale'])
    const previousTitle = document.title
    const b = await bench()
    const firstDeclaration = declare(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    let entry = b.slots.entries('settings.section')[0]!
    expect(entry.component).toBe(AboutSection)
    expect(entry.options).toMatchObject({ id: 'about', order: 100 })
    expect(resolveSlotLabel(entry.options.label)).toBe('关于与致谢')
    expect(document.documentElement.dataset.dshProduct).toBe('koying-pilot')
    expect(document.title).toBe('柯影智航')
    const injected = entry.inject as unknown as () => AboutSectionInjected
    expect(injected().t('teamBody')).toContain('柯影数智团队')

    b.locale.setLocale('en')
    expect(resolveSlotLabel(entry.options.label)).toBe('About & thanks')
    firstDeclaration()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    declare(b.slots)
    await Promise.resolve()
    entry = b.slots.entries('settings.section')[0]!
    expect(entry.component).toBe(AboutSection)

    await fiber.dispose()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    expect(document.documentElement.dataset.dshProduct).toBeUndefined()
    expect(document.title).toBe(previousTitle)
    expect(() => b.locale.register('settings.about', 'zh', {})).not.toThrow()
    expect(() => b.locale.register('settings.about', 'en', {})).not.toThrow()
  })

  it('waits for a later settings declaration', async () => {
    const b = await bench()
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    declare(b.slots)
    await Promise.resolve()
    expect(b.slots.entries('settings.section')[0]!.component).toBe(AboutSection)
  })
})
