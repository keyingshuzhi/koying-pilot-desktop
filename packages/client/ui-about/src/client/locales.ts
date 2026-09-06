/** Locale copy for the Koying Pilot About and acknowledgements page. */

/** Copy keys rendered by the page. */
export type AboutKey =
  | 'nav' | 'eyebrow' | 'title' | 'intro' | 'teamTitle' | 'teamBody'
  | 'thanksTitle' | 'thanksBody' | 'privacyTitle' | 'privacyBody'
  | 'versionLabel' | 'version' | 'copyright'

/** English copy. */
export const en: Record<AboutKey, string> = {
  nav: 'About & thanks',
  eyebrow: 'Koying Digital Intelligence · AI Agent',
  title: 'Koying Pilot',
  intro: 'A desktop AI-agent workspace designed for continuous product evolution.',
  teamTitle: 'Development team',
  teamBody: 'Packaged and developed by the Koying Digital Intelligence team. Product capabilities and experience will continue to evolve.',
  thanksTitle: 'Acknowledgements',
  thanksBody: 'With thanks to DeepSeek Harness, Cordis, Node.js, React, WebKit, their contributors, and the wider open-source community.',
  privacyTitle: 'Model configuration',
  privacyBody: 'Provider settings and credentials are configured on this Mac. No usable API key is embedded in the installer.',
  versionLabel: 'Version',
  version: '0.1.1',
  copyright: '© 2026 Koying Digital Intelligence team',
}

/** Simplified Chinese copy. */
export const zh: Record<AboutKey, string> = {
  nav: '关于与致谢',
  eyebrow: '柯影数智 · AI Agent',
  title: '柯影智航',
  intro: '面向持续产品迭代的桌面智能体工作空间。',
  teamTitle: '开发团队',
  teamBody: '本产品由柯影数智团队封装开发，后续将持续迭代产品能力与使用体验。',
  thanksTitle: '致谢',
  thanksBody: '感谢 DeepSeek Harness、Cordis、Node.js、React、WebKit 的贡献者，以及更广泛的开源社区。',
  privacyTitle: '模型配置',
  privacyBody: '模型提供方设置与凭据保存在这台 Mac 上，安装包内不嵌入任何可用 API 密钥。',
  versionLabel: '版本',
  version: '0.1.1',
  copyright: '© 2026 柯影数智团队',
}
