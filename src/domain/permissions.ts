import type { OrderStatus, UserRole } from './types'

export type PermissionActor = 'GUEST' | UserRole

export type Permission =
  | 'VIEW_ACTIVE_PRODUCTS'
  | 'VIEW_NON_ACTIVE_PRODUCTS'
  | 'ADD_TO_CART'
  | 'CHECKOUT'
  | 'VIEW_OWN_ORDERS'
  | 'VIEW_ANY_ORDER'
  | 'CANCEL_OWN_ORDER'
  | 'MANAGE_PROFILE_ADDRESSES'
  | 'MANAGE_ADMIN_AREA'

export interface PermissionContext {
  orderStatus?: OrderStatus
  orderOwner?: boolean
  emailVerified?: boolean
}

export function hasPermission(
  actor: PermissionActor,
  permission: Permission,
  context: PermissionContext = {},
): boolean {
  switch (permission) {
    case 'VIEW_ACTIVE_PRODUCTS':
      return true
    case 'VIEW_NON_ACTIVE_PRODUCTS':
      return actor === 'ADMIN'
    case 'ADD_TO_CART':
      return actor === 'GUEST' || actor === 'CUSTOMER'
    case 'CHECKOUT':
      return actor === 'CUSTOMER' && context.emailVerified === true
    case 'VIEW_OWN_ORDERS':
      return actor === 'CUSTOMER'
    case 'VIEW_ANY_ORDER':
      return actor === 'ADMIN'
    case 'CANCEL_OWN_ORDER':
      return (
        actor === 'CUSTOMER' &&
        context.orderOwner === true &&
        context.orderStatus === 'PENDING'
      )
    case 'MANAGE_PROFILE_ADDRESSES':
      return actor === 'CUSTOMER'
    case 'MANAGE_ADMIN_AREA':
      return actor === 'ADMIN'
  }
}

export function canViewProduct(
  actor: PermissionActor,
  isActive: boolean,
): boolean {
  return isActive
    ? hasPermission(actor, 'VIEW_ACTIVE_PRODUCTS')
    : hasPermission(actor, 'VIEW_NON_ACTIVE_PRODUCTS')
}
