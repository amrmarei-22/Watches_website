import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import type { Product, ProductImage, ProductSpecs, ProductStatus } from '../../domain/types'

type ProductRow = {
  id: string
  sku: string
  name_ar: string
  name_en: string
  brand: string
  description_ar: string
  description_en: string
  price: number
  stock: number
  low_stock_override: number | null
  status: ProductStatus
  featured: boolean
  specs: ProductSpecs
  created_at: string
  updated_at: string
  product_images: Array<{ id: string; path: string; position: number; is_primary: boolean }>
}

function mapProduct(row: ProductRow): Product {
  const images: ProductImage[] = row.product_images
    .map((image) => ({
      id: image.id,
      path: image.path,
      position: image.position,
      isPrimary: image.is_primary,
    }))
    .sort((a, b) => a.position - b.position)
  return {
    id: row.id,
    sku: row.sku,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    brand: row.brand,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    price: row.price,
    stock: row.stock,
    lowStockThresholdOverride: row.low_stock_override,
    status: row.status,
    featured: row.featured,
    images,
    specs: row.specs,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('status', 'ACTIVE')
  if (error) throw error
  return (data as ProductRow[]).map(mapProduct)
}

export function useCatalogProducts() {
  return useQuery({
    queryKey: ['catalog', 'products', 'active'],
    queryFn: fetchProducts,
  })
}

export { mapProduct, fetchProducts }
