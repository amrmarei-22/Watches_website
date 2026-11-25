import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLanguage } from '../lib/i18n'

const { storageFrom, createSignedUrl } = vi.hoisted(() => ({
  storageFrom: vi.fn(),
  createSignedUrl: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  supabase: { storage: { from: storageFrom } },
}))

import { ReceiptPreview } from './AdminOperations'

describe('ReceiptPreview', () => {
  beforeEach(async () => {
    await setLanguage('en')
    storageFrom.mockReset()
    createSignedUrl.mockReset()
    storageFrom.mockReturnValue({ createSignedUrl })
  })

  it('shows an empty state without signing an empty receipt path', () => {
    render(<ReceiptPreview path="  " uploadedAt={null} />)

    expect(screen.getByRole('status')).toHaveTextContent('No receipt uploaded yet.')
    expect(storageFrom).not.toHaveBeenCalled()
  })

  it('logs storage errors and retries signing the receipt', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    createSignedUrl
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Object not found', code: '404', details: 'storage object missing' },
      })
      .mockResolvedValueOnce({ data: { signedUrl: 'https://example.test/receipt' }, error: null })

    render(<ReceiptPreview path="order-id/receipt.png" uploadedAt={null} />)

    expect(await screen.findByText('Failed to load receipt image.')).toBeInTheDocument()
    expect(consoleError).toHaveBeenCalledWith('[admin] order-details.receipt-preview failed', {
      message: 'Object not found',
      code: '404',
      details: 'storage object missing',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('button', { name: 'Open receipt preview' })).toBeInTheDocument()
    expect(storageFrom).toHaveBeenCalledWith('payment-proofs')
    expect(createSignedUrl).toHaveBeenNthCalledWith(1, 'order-id/receipt.png', 3600)
    expect(createSignedUrl).toHaveBeenNthCalledWith(2, 'order-id/receipt.png', 3600)
    consoleError.mockRestore()
  })
})
