/** Koying Pilot About and acknowledgements settings contribution. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { AboutSection } from './AboutSection.tsx'
import type { AboutSectionInjected } from './AboutSection.tsx'
import { en, zh, type AboutKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Koying Pilot product identity and acknowledgements copy. */
    'settings.about': AboutKey
  }
}

const NS = 'settings.about'

/** Services required by the settings contribution. */
export const inject = ['slots', 'locale']

/**
 * Register the localized About page when the settings shell declares its section slot.
 * @param ctx - browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const root = document.documentElement
    const previousProduct = root.getAttribute('data-dsh-product')
    const previousTitle = document.title
    root.setAttribute('data-dsh-product', 'koying-pilot')
    document.title = '柯影智航'
    return () => {
      if (previousProduct === null) root.removeAttribute('data-dsh-product')
      else root.setAttribute('data-dsh-product', previousProduct)
      document.title = previousTitle
    }
  }, 'ui-about: product identity')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-about: dictionaries')
  const t = ctx.locale.bind(NS)
  const injected = (): AboutSectionInjected => ({ t })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'about',
    order: 100,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, AboutSection))
}
