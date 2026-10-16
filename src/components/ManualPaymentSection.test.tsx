import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ManualPaymentSection } from './ManualPaymentSection'
import { setLanguage } from '../lib/i18n'

describe('ManualPaymentSection', () => {
  beforeAll(async () => {
    await setLanguage('en')
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    window.URL.revokeObjectURL = vi.fn()
  })

  it('renders account number and copy button', async () => {
    render(
      <ManualPaymentSection
        accountNumber="01000000000"
        receipt={null}
        onReceiptChange={vi.fn()}
      />
    )

    expect(screen.getByText('01000000000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    expect(screen.getByText(/vodafone cash • instapay • bank transfer/i)).toBeInTheDocument()
  })

  it('copies account number to clipboard on copy button click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <ManualPaymentSection
        accountNumber="01000000000"
        receipt={null}
        onReceiptChange={vi.fn()}
      />
    )

    const copyBtn = screen.getByRole('button', { name: /copy/i })
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('01000000000')
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
  })

  it('shows error when invalid file type is uploaded', () => {
    const onReceiptChange = vi.fn()
    const { container } = render(
      <ManualPaymentSection
        accountNumber="01000000000"
        receipt={null}
        onReceiptChange={onReceiptChange}
      />
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(['dummy content'], 'statement.pdf', { type: 'application/pdf' })

    fireEvent.change(input, { target: { files: [pdfFile] } })

    expect(onReceiptChange).not.toHaveBeenCalled()
    expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument()
  })

  it('shows error when file larger than 5MB is uploaded', () => {
    const onReceiptChange = vi.fn()
    const { container } = render(
      <ManualPaymentSection
        accountNumber="01000000000"
        receipt={null}
        onReceiptChange={onReceiptChange}
      />
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const largeFile = new File(['a'.repeat(10)], 'receipt.png', { type: 'image/png' })
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 })

    fireEvent.change(input, { target: { files: [largeFile] } })

    expect(onReceiptChange).not.toHaveBeenCalled()
    expect(screen.getByText(/file size exceeds/i)).toBeInTheDocument()
  })

  it('calls onReceiptChange when a valid image is selected', () => {
    const onReceiptChange = vi.fn()
    const { container } = render(
      <ManualPaymentSection
        accountNumber="01000000000"
        receipt={null}
        onReceiptChange={onReceiptChange}
      />
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const validFile = new File(['image-bytes'], 'receipt.jpg', { type: 'image/jpeg' })

    fireEvent.change(input, { target: { files: [validFile] } })

    expect(onReceiptChange).toHaveBeenCalledWith(validFile)
  })

  it('renders image preview and allows removing receipt', () => {
    const onReceiptChange = vi.fn()
    const mockFile = new File(['bytes'], 'my-receipt.png', { type: 'image/png' })
    Object.defineProperty(mockFile, 'size', { value: 1.2 * 1024 * 1024 })

    render(
      <ManualPaymentSection
        accountNumber="01000000000"
        receipt={mockFile}
        onReceiptChange={onReceiptChange}
      />
    )

    expect(screen.getByText('my-receipt.png')).toBeInTheDocument()
    expect(screen.getByText(/1.2 MB/i)).toBeInTheDocument()
    expect(screen.getByText(/receipt attached successfully/i)).toBeInTheDocument()

    const removeBtn = screen.getByRole('button', { name: /remove/i })
    fireEvent.click(removeBtn)

    expect(onReceiptChange).toHaveBeenCalledWith(null)
  })
})
