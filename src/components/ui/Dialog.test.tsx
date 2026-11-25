import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Dialog } from './Dialog'

function DialogHarness() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const openerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog
        open={open}
        title="Reject receipt"
        onClose={() => setOpen(false)}
        initialFocusRef={inputRef}
        returnFocusRef={openerRef}
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="button">Continue</button>
      </Dialog>
    </>
  )
}

describe('Dialog focus management', () => {
  it('keeps focus in the textarea while rerendering and restores the opener on close', () => {
    render(<DialogHarness />)
    const opener = screen.getByRole('button', { name: 'Open dialog' })
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Reject receipt' })
    const textarea = dialog.querySelector('textarea')
    const closeButton = dialog.querySelector<HTMLButtonElement>('.ui-close')
    const lastButton = screen.getByRole('button', { name: 'Continue' })
    expect(textarea).toHaveFocus()
    expect(document.documentElement).toHaveAttribute('data-scroll-locked', 'true')

    let text = ''
    for (const character of 'A full sentence in the reason field.') {
      text += character
      fireEvent.change(textarea!, { target: { value: text } })
      expect(textarea).toHaveFocus()
    }

    closeButton!.focus()
    fireEvent.keyDown(closeButton!, { key: 'Tab', shiftKey: true })
    expect(lastButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(document.documentElement).not.toHaveAttribute('data-scroll-locked')
  })
})
