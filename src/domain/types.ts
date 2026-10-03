export const userRoles = ['CUSTOMER', 'ADMIN'] as const
export type UserRole = (typeof userRoles)[number]

export const productStatuses = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const
export type ProductStatus = (typeof productStatuses)[number]

export const availabilityValues = [
  'IN_STOCK',
  'LOW_STOCK',
  'OUT_OF_STOCK',
] as const
export type Availability = (typeof availabilityValues)[number]

export const orderStatuses = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const
export type OrderStatus = (typeof orderStatuses)[number]

export const paymentMethods = ['COD'] as const
export type PaymentMethod = (typeof paymentMethods)[number]

export interface ProductSpecs {
  caseSize: number
  movement: string
  material: string
  waterResistance: number
  strap: string
  gender: string
}

export interface Product {
  id: string
  sku: string
  nameAr: string
  nameEn: string
  brand: string
  descriptionAr: string
  descriptionEn: string
  price: number
  stock: number
  lowStockThresholdOverride: number | null
  status: ProductStatus
  featured: boolean
  images: ProductImage[]
  specs: ProductSpecs
  createdAt: string
  updatedAt: string
}

export interface ProductImage {
  id: string
  path: string
  position: number
  isPrimary: boolean
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  passwordHash: string
  role: UserRole
  emailVerified: boolean
  createdAt: string
}

export interface Address {
  id: string
  userId: string
  fullName: string
  phone: string
  governorate: string
  city: string
  street: string
  building: string
  notes: string | null
}

export interface OrderLine {
  productId: string
  skuSnapshot: string
  nameSnapshot: string
  unitPriceSnapshot: number
  quantity: number
  lineTotal: number
}

export interface StatusHistoryEntry {
  from: OrderStatus | null
  to: OrderStatus
  actorId: string
  actorRole: UserRole
  reason: string | null
  timestamp: string
}

export interface Order {
  id: string
  orderNumber: string
  userId: string
  status: OrderStatus
  lines: OrderLine[]
  subtotal: number
  shippingFee: number
  total: number
  paymentMethod: PaymentMethod
  shippingAddressSnapshot: Address
  statusHistory: StatusHistoryEntry[]
  createdAt: string
  updatedAt: string
}
