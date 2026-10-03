import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuthState } from './useAuthState'
import { supabase } from '../lib/supabaseClient'
import { mapProduct } from '../features/catalog/catalogQuery'
import { maxQuantity, canAddToCart } from '../domain/inventory'
import { guestCartExpiry, isGuestCartExpired, parseGuestCartStorage, revalidateGuestLines, subtotal, type CartChange, type CartLine, type GuestCartLine } from '../domain/cart'
import type { Product } from '../domain/types'

const STORAGE_KEY = 'vintage_guest_cart_v1'
type CartContextValue = {
  items: CartLine[]
  count: number
  subtotal: number
  changes: CartChange[]
  error: string | null
  drawerOpen: boolean
  added: boolean
  addItem: (product: Product, quantity: number) => Promise<void>
  setQuantity: (productId: string, quantity: number) => Promise<void>
  removeItem: (productId: string) => Promise<void>
  revalidate: () => Promise<CartChange[]>
  closeDrawer: () => void
}
const CartContext = createContext<CartContextValue | null>(null)

function readStored(): { expiresAt: number; items: GuestCartLine[] } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = parseGuestCartStorage(raw)
    if (!parsed || isGuestCartExpired(parsed.expiresAt)) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}
function writeStored(items: GuestCartLine[]): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ expiresAt: guestCartExpiry(), items })) } catch { /* storage is optional */ }
}
function clearStored(): void { try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* storage is optional */ } }
function errorCode(error: { message?: string } | null): string { return error?.message ?? 'PAGE_500' }

export function CartProvider({ children }: { children: ReactNode }) {
  const auth = useAuthState()
  const [items, setItems] = useState<CartLine[]>([])
  const [changes, setChanges] = useState<CartChange[]>([])
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [added, setAdded] = useState(false)
  const [loadedRole, setLoadedRole] = useState(auth.role)

  const fetchGuest = useCallback(async (): Promise<CartLine[]> => {
    const stored = readStored()
    if (!stored) { setItems([]); return [] }
    const ids = stored.items.map((item) => item.productId)
    if (!ids.length) { setItems([]); return [] }
    const result = await supabase.from('products').select('*, product_images(*)').in('id', ids)
    if (result.error) throw result.error
    const products = (result.data as Parameters<typeof mapProduct>[0][]).map(mapProduct)
    const byId = new Map(products.map((product) => [product.id, product]))
    const next = stored.items.flatMap((line) => { const product = byId.get(line.productId); return product ? [{ product, quantity: line.quantity, priceSeen: line.price_seen }] : [] })
    setItems(next)
    return next
  }, [])
  const fetchCustomer = useCallback(async () => {
    const result = await supabase.from('cart_items').select('*, products(*, product_images(*))')
    if (result.error) throw result.error
    const next = (result.data as Array<{ quantity: number; products: Parameters<typeof mapProduct>[0] | null }>).flatMap((row) => row.products ? [{ product: mapProduct(row.products), quantity: row.quantity, priceSeen: mapProduct(row.products).price }] : [])
    setItems(next)
  }, [])
  const load = useCallback(async () => {
    setError(null)
    try { if (auth.role === 'CUSTOMER') await fetchCustomer(); else if (auth.role === 'GUEST') await fetchGuest(); else setItems([]) }
    catch (reason) { setError(errorCode(reason as { message?: string })); }
  }, [auth.role, fetchCustomer, fetchGuest])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (loadedRole === 'GUEST' && auth.role === 'CUSTOMER') {
      const stored = readStored()
      if (stored?.items.length) void (async () => {
        const result = await supabase.rpc('merge_guest_cart', { p_items: stored.items.map(({ productId, quantity }) => ({ product_id: productId, quantity })) })
        if (result.error) { setError(errorCode(result.error)); return }
        clearStored()
        setChanges((result.data as { changes?: CartChange[] }).changes ?? [])
        await fetchCustomer()
      })()
      else void fetchCustomer()
    }
    setLoadedRole(auth.role)
  }, [auth.role, fetchCustomer, loadedRole])
  const addItem = useCallback(async (product: Product, quantity: number) => {
    setError(null)
    if (!canAddToCart(product, 1)) { setError('CART_ITEM_UNAVAILABLE'); throw new Error('CART_ITEM_UNAVAILABLE') }
    const existing = items.find((item) => item.product.id === product.id)?.quantity ?? 0
    const requested = Math.min(existing + quantity, maxQuantity(product))
    if (auth.role === 'CUSTOMER') {
      const result = await supabase.rpc('cart_set_item', { p_product_id: product.id, p_quantity: requested })
      if (result.error) { setError(errorCode(result.error)); throw result.error }
      if ((result.data as { clamped?: boolean }).clamped) setChanges([{ code: 'CART_QTY_CLAMPED', productId: product.id, n: (result.data as { quantity: number }).quantity, nameAr: product.nameAr, nameEn: product.nameEn }])
      await fetchCustomer()
    } else {
      const next = [...items.filter((item) => item.product.id !== product.id), { product, quantity: requested, priceSeen: product.price }]
      setItems(next); writeStored(next.map((item) => ({ productId: item.product.id, quantity: item.quantity, price_seen: item.priceSeen })))
    }
    setDrawerOpen(true)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 4000)
  }, [auth.role, fetchCustomer, items])
  const setQuantity = useCallback(async (productId: string, quantity: number) => {
    const line = items.find((item) => item.product.id === productId)
    if (!line) return
    if (auth.role === 'CUSTOMER') { const result = await supabase.rpc('cart_set_item', { p_product_id: productId, p_quantity: quantity }); if (result.error) throw result.error; await fetchCustomer() }
    else { const next = items.map((item) => item.product.id === productId ? { ...item, quantity: Math.min(quantity, maxQuantity(item.product)) } : item); setItems(next); writeStored(next.map((item) => ({ productId: item.product.id, quantity: item.quantity, price_seen: item.priceSeen }))) }
  }, [auth.role, fetchCustomer, items])
  const removeItem = useCallback(async (productId: string) => {
    if (auth.role === 'CUSTOMER') { const result = await supabase.rpc('cart_set_item', { p_product_id: productId, p_quantity: 0 }); if (result.error) throw result.error; await fetchCustomer() }
    else { const next = items.filter((item) => item.product.id !== productId); setItems(next); writeStored(next.map((item) => ({ productId: item.product.id, quantity: item.quantity, price_seen: item.priceSeen }))) }
  }, [auth.role, fetchCustomer, items])
  const revalidate = useCallback(async () => {
    if (auth.role === 'CUSTOMER') {
      const result = await supabase.rpc('validate_cart')
      if (result.error) throw result.error
      const next = (result.data as { changes?: CartChange[] }).changes ?? []
      setChanges(next); await fetchCustomer(); return next
    }
    if (auth.role === 'GUEST') {
      const fresh = await fetchGuest()
      const result = revalidateGuestLines(fresh)
      setItems(result.lines); setChanges(result.changes)
      writeStored(result.lines.map((item) => ({ productId: item.product.id, quantity: item.quantity, price_seen: item.priceSeen })))
      return result.changes
    }
    return []
  }, [auth.role, fetchCustomer, fetchGuest, items])
  const value = useMemo(() => ({ items, count: items.reduce((total, item) => total + item.quantity, 0), subtotal: subtotal(items), changes, error, drawerOpen, added, addItem, setQuantity, removeItem, revalidate, closeDrawer: () => setDrawerOpen(false) }), [added, addItem, changes, drawerOpen, error, items, removeItem, revalidate, setQuantity])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
export function useCart(): CartContextValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used within CartProvider')
  return value
}
