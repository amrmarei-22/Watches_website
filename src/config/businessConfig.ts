export const businessConfig = {
  lowStockThresholdDefault: 3,
  maxQtyPerLine: 3,
  shippingFlatFee: 0,
  pageSize: 12,
  sessionIdleTimeoutMin: {
    customer: 30,
    admin: 15,
  },
  sessionAbsoluteMaxHours: {
    customer: 12,
    admin: 8,
  },
  guestCartTtlDays: 30,
  maxFailedLogins: 5,
  lockoutMinutes: 15,
  passwordMinLength: 8,
  emailVerifyTtlHours: 24,
  passwordResetTtlMinutes: 60,
  maxImagesPerProduct: 8,
  maxImageMb: 5,
  maxAddressesPerUser: 5,
  brand: {
    nameEn: 'Vintage',
    nameAr: 'فينتج',
  },
} as const

export const LOW_STOCK_THRESHOLD_DEFAULT =
  businessConfig.lowStockThresholdDefault
export const MAX_QTY_PER_LINE = businessConfig.maxQtyPerLine
export const SHIPPING_FLAT_FEE = businessConfig.shippingFlatFee
export const PAGE_SIZE = businessConfig.pageSize
export const SESSION_IDLE_TIMEOUT_MIN = businessConfig.sessionIdleTimeoutMin
export const SESSION_ABSOLUTE_MAX_HOURS =
  businessConfig.sessionAbsoluteMaxHours
export const GUEST_CART_TTL_DAYS = businessConfig.guestCartTtlDays
export const MAX_FAILED_LOGINS = businessConfig.maxFailedLogins
export const LOCKOUT_MINUTES = businessConfig.lockoutMinutes
export const PASSWORD_MIN_LENGTH = businessConfig.passwordMinLength
export const EMAIL_VERIFY_TTL_HOURS = businessConfig.emailVerifyTtlHours
export const PASSWORD_RESET_TTL_MINUTES =
  businessConfig.passwordResetTtlMinutes
export const MAX_IMAGES_PER_PRODUCT = businessConfig.maxImagesPerProduct
export const MAX_IMAGE_MB = businessConfig.maxImageMb
export const MAX_ADDRESSES_PER_USER = businessConfig.maxAddressesPerUser
export const brand = businessConfig.brand
