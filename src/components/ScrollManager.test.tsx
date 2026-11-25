import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScrollManager } from './ScrollManager'

function NavigationHarness() {
  const navigate = useNavigate()
  return (
    <main id="main-content" data-scroll-container="test-main" tabIndex={-1}>
      <h1>Page heading</h1>
      <div id="target">Anchor target</div>
      <button onClick={() => navigate('/two')}>Push route</button>
      <button onClick={() => navigate('?filter=active')}>Change query</button>
      <button onClick={() => navigate('/two#target')}>Open anchor</button>
      <button onClick={() => navigate(-1)}>Go back</button>
    </main>
  )
}

function renderManager() {
  return render(
    <MemoryRouter initialEntries={['/one']}>
      <ScrollManager />
      <NavigationHarness />
    </MemoryRouter>,
  )
}

describe('ScrollManager', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() })
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 })
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  })

  it('resets on pathname navigation but leaves query-only changes alone', () => {
    renderManager()
    vi.mocked(window.scrollTo).mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Change query' }))
    expect(window.scrollTo).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Push route' }))
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'instant' })
    expect(screen.getByRole('heading', { name: 'Page heading' })).toHaveFocus()
  })

  it('restores a saved position on browser back navigation', () => {
    renderManager()
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 240 })
    fireEvent.scroll(window)
    vi.mocked(window.scrollTo).mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Push route' }))
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 80 })
    fireEvent.scroll(window)
    vi.mocked(window.scrollTo).mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))

    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 240, behavior: 'instant' })
  })

  it('scrolls to an existing hash target', () => {
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Open anchor' }))

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  })
})
