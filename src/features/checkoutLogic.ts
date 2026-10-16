export function shouldShowNewAddressForm(savedAddressCount: number, requestedOpen: boolean): boolean {
  return savedAddressCount === 0 || requestedOpen
}

export function isAddressSelected(selectedId: string | null, addressId: string): boolean {
  return selectedId === addressId
}

export const ALLOWED_RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ALLOWED_RECEIPT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const

export type ReceiptValidationError = 'RECEIPT_INVALID_TYPE' | 'RECEIPT_MAX_SIZE'

export function validateReceiptFile(
  file: { name: string; type: string; size: number },
  maxMb = 5
): { valid: true; error?: never } | { valid: false; error: ReceiptValidationError } {
  const extension = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  const hasValidExt = ALLOWED_RECEIPT_EXTENSIONS.includes(extension as (typeof ALLOWED_RECEIPT_EXTENSIONS)[number])
  const hasValidMime = ALLOWED_RECEIPT_MIME_TYPES.includes(file.type as (typeof ALLOWED_RECEIPT_MIME_TYPES)[number])

  if (!hasValidMime && !hasValidExt) {
    return { valid: false, error: 'RECEIPT_INVALID_TYPE' }
  }

  const maxBytes = maxMb * 1024 * 1024
  if (file.size > maxBytes) {
    return { valid: false, error: 'RECEIPT_MAX_SIZE' }
  }

  return { valid: true }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function canPlaceManualOrder(hasReceipt: boolean, isSubmitting: boolean): boolean {
  return hasReceipt && !isSubmitting
}
