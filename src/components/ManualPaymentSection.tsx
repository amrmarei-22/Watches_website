import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  RefreshCw,
  Trash2,
  UploadCloud,
  Wallet,
} from 'lucide-react'
import {
  formatFileSize,
  validateReceiptFile,
} from '../features/checkoutLogic'
import { MAX_RECEIPT_MB } from '../config/businessConfig'

export interface ManualPaymentSectionProps {
  accountNumber: string
  receipt: File | null
  onReceiptChange: (file: File | null) => void
  disabled?: boolean
  errorMessage?: string | null
  onClearError?: () => void
}

export function ManualPaymentSection({
  accountNumber,
  receipt,
  onReceiptChange,
  disabled = false,
  errorMessage,
  onClearError,
}: ManualPaymentSectionProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!receipt) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(receipt)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [receipt])

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(accountNumber)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = accountNumber
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // If clipboard access is restricted, don't crash
      setCopied(false)
    }
  }

  const handleFileProcess = (file: File | undefined | null) => {
    if (!file) return
    const validation = validateReceiptFile(file, MAX_RECEIPT_MB)
    if (!validation.valid) {
      const errorMsg =
        validation.error === 'RECEIPT_MAX_SIZE'
          ? t('checkout.receiptMaxSize')
          : t('checkout.receiptInvalidType')
      setLocalError(errorMsg)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setLocalError(null)
    onClearError?.()
    onReceiptChange(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    handleFileProcess(file)
  }

  const handleRemoveReceipt = () => {
    onReceiptChange(null)
    setLocalError(null)
    onClearError?.()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const activeError = localError || errorMessage

  return (
    <div className="manual-payment-wrapper">
      {/* 1. Account Details Card */}
      <section className="manual-payment-card" aria-labelledby="manual-account-heading">
        <div className="manual-payment-card-header">
          <div className="manual-payment-card-title">
            <span className="manual-payment-icon-badge" aria-hidden="true">
              <Wallet size={18} />
            </span>
            <h3 id="manual-account-heading">{t('checkout.manualPaymentDetails')}</h3>
          </div>
          <span className="manual-payment-methods-badge">
            {t('checkout.manualPaymentMethods')}
          </span>
        </div>

        <p className="manual-payment-instructions">
          {t('checkout.manualPaymentInstructions')}
        </p>

        <div className="manual-account-box">
          <div className="manual-account-label-group">
            <span className="manual-account-label">{t('checkout.manualPaymentAccount')}</span>
            <span className="manual-account-number" dir="ltr" aria-label={accountNumber}>
              {accountNumber}
            </span>
          </div>

          <button
            type="button"
            className={`manual-copy-btn ${copied ? 'copied' : ''}`}
            onClick={() => void handleCopy()}
            aria-label={t('checkout.copyAccount')}
            title={t('checkout.copyAccount')}
          >
            {copied ? (
              <>
                <Check size={16} aria-hidden="true" />
                <span>{t('checkout.accountCopied')}</span>
              </>
            ) : (
              <>
                <Copy size={16} aria-hidden="true" />
                <span>{t('checkout.copyAccount')}</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* 2. Receipt Upload Card */}
      <section className="receipt-upload-card" aria-labelledby="receipt-upload-heading">
        <div className="receipt-upload-header">
          <h3 id="receipt-upload-heading" className="receipt-upload-title">
            {t('checkout.receiptUploadTitle')}
          </h3>
          <span className="receipt-required-badge">
            {t('checkout.receiptUploadRequired')}
          </span>
        </div>

        {activeError && (
          <div className="receipt-error-banner" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{activeError}</span>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          id="receipt-file-input"
          className="receipt-file-input-hidden"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          disabled={disabled}
          onChange={(e) => handleFileProcess(e.target.files?.[0])}
        />

        {!receipt ? (
          /* Dropzone / Upload Trigger UI */
          <div
            className={`receipt-dropzone ${isDragging ? 'dragging' : ''} ${
              activeError ? 'has-error' : ''
            }`}
            onClick={() => !disabled && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              if (disabled) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            aria-label={t('checkout.chooseReceipt')}
          >
            <div className="receipt-dropzone-icon" aria-hidden="true">
              <UploadCloud size={28} />
            </div>
            <p className="receipt-dropzone-cta">{t('checkout.dragOrBrowseReceipt')}</p>
            <span className="receipt-dropzone-hint">{t('checkout.receiptConstraints')}</span>
          </div>
        ) : (
          /* Uploaded Receipt Preview UI */
          <div className="receipt-preview-card">
            <div className="receipt-preview-thumb-wrapper">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={t('checkout.receipt')}
                  className="receipt-preview-img"
                />
              ) : (
                <div className="receipt-preview-placeholder" aria-hidden="true" />
              )}
            </div>

            <div className="receipt-preview-info">
              <div className="receipt-preview-status">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{t('checkout.receiptReady')}</span>
              </div>
              <p className="receipt-filename" title={receipt.name}>
                {receipt.name}
              </p>
              <span className="receipt-filesize">{formatFileSize(receipt.size)}</span>

              <div className="receipt-preview-actions">
                <button
                  type="button"
                  className="receipt-action-btn receipt-change-btn"
                  onClick={() => !disabled && fileInputRef.current?.click()}
                  disabled={disabled}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  <span>{t('checkout.changeReceipt')}</span>
                </button>
                <button
                  type="button"
                  className="receipt-action-btn receipt-remove-btn"
                  onClick={handleRemoveReceipt}
                  disabled={disabled}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>{t('checkout.removeReceipt')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
