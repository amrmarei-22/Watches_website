import type { Product } from '../domain/types'

export function useCart() {
  return {
    addItem: async (_product: Product, _quantity: number): Promise<void> => {
      // TODO(task6): connect to cart_set_item and surface its result.
    },
  }
}
