// @vitest-environment jsdom
/** User-visible About and acknowledgements copy. */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AboutSection } from '../src/client/AboutSection.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

describe('AboutSection', () => {
  it('renders nothing before injection', () => {
    render(<AboutSection />)
    expect(document.body.textContent).toBe('')
  })

  it('renders product identity, team attribution, acknowledgements, and model privacy copy', () => {
    render(<AboutSection t={key => zh[key]} />)
    expect(screen.getByRole('heading', { name: '柯影智航' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '开发团队' })).toBeTruthy()
    expect(screen.getByText(/柯影数智团队封装开发/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: '致谢' })).toBeTruthy()
    expect(screen.getByText(/DeepSeek Harness/)).toBeTruthy()
    expect(screen.getByText(/安装包内不嵌入任何可用 API 密钥/)).toBeTruthy()
    expect(screen.getByText('版本 0.1.1')).toBeTruthy()
  })
})
