/** Koying Pilot product identity and acknowledgements settings page. */

import type { ReactNode } from 'react'
import type { AboutKey } from './locales.ts'
import css from './AboutSection.module.css'

/** Registration-owned copy face. */
export interface AboutSectionInjected {
  /** Translate one About-page key in the active locale. */
  t: (key: AboutKey) => string
}

/** Props delivered by the settings slot outlet. */
export type AboutSectionProps = Partial<AboutSectionInjected>

/**
 * Render product identity, team attribution, acknowledgements, and credential stance.
 * @param props - slot-delivered copy face.
 * @returns the About page, or nothing before injection completes.
 */
export function AboutSection({ t }: AboutSectionProps): ReactNode {
  if (t === undefined) return null
  return (
    <section className={css.section}>
      <header className={css.hero}>
        <div className={css.mark} aria-hidden="true">K</div>
        <div>
          <p className={css.eyebrow}>{t('eyebrow')}</p>
          <h2 className={css.title}>{t('title')}</h2>
          <p className={css.intro}>{t('intro')}</p>
        </div>
      </header>

      <div className={css.card}>
        <h3>{t('teamTitle')}</h3>
        <p>{t('teamBody')}</p>
      </div>
      <div className={css.card}>
        <h3>{t('thanksTitle')}</h3>
        <p>{t('thanksBody')}</p>
      </div>
      <div className={css.card}>
        <h3>{t('privacyTitle')}</h3>
        <p>{t('privacyBody')}</p>
      </div>

      <footer className={css.footer}>
        <span>{t('versionLabel')} {t('version')}</span>
        <span>{t('copyright')}</span>
      </footer>
    </section>
  )
}
