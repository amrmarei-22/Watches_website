import { supabase } from '../../lib/supabaseClient'

export function getProductImageUrl(path: string): string {
  if (path.startsWith('/')) return path
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}
