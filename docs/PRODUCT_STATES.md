# Product States

## 1. Two separate concepts (do NOT merge them)
1. **Status** — stored, set by admin: `DRAFT | ACTIVE | ARCHIVED`
2. **Availability** — derived from stock, never stored: `IN_STOCK | LOW_STOCK | OUT_OF_STOCK`

Availability only matters when status = ACTIVE.

## 2. Status
| Status | Meaning | Visible to public | Purchasable |
|--------|---------|:-:|:-:|
| DRAFT | Being prepared | ❌ | ❌ |
| ACTIVE | Live in store | ✅ | depends on availability |
| ARCHIVED | Retired; kept for order history | ❌ (product URL → 404) | ❌ |

### Allowed transitions
| From → To | Who | Conditions |
|-----------|-----|-----------|
| (new) → DRAFT | Admin | Always |
| DRAFT → ACTIVE | Admin | BR 8.6 satisfied |
| ACTIVE → ARCHIVED | Admin | Always. Removes from carts (BR 3.6) |
| ARCHIVED → ACTIVE | Admin | BR 8.6 satisfied |
| ARCHIVED → DRAFT | Admin | Always |
| ACTIVE → DRAFT | Admin | Always (unpublish). Removes from carts |
| DRAFT → (hard delete) | Admin | Only if never ordered/carted (BR 9.1) |
Any other transition is illegal.

## 3. Availability (derived)
```
threshold = product.lowStockThresholdOverride ?? LOW_STOCK_THRESHOLD_DEFAULT

if stock <= 0           → OUT_OF_STOCK
else if stock <= threshold → LOW_STOCK
else                    → IN_STOCK
```
Example with threshold 3: stock 0 → OUT_OF_STOCK; 1,2,3 → LOW_STOCK; 4+ → IN_STOCK.

### Effects
| Availability | Product page | Listing | Add to cart | Admin inventory |
|--------------|--------------|---------|-------------|-----------------|
| IN_STOCK | Normal | Normal | Enabled | Green |
| LOW_STOCK | Show "Only {n} left" | Show "Only {n} left" badge | Enabled (qty max = stock) | Amber |
| OUT_OF_STOCK | "Out of stock" label | "Out of stock" badge | Disabled button labeled "Out of stock" | Red |

## 4. Triggers that re-evaluate availability
Admin stock update; order created (deduct); order cancelled (restore). Availability is recomputed on read, so no stored flag can go stale.

## 5. Edge cases
- Stock reaches 0 while product is in someone's cart → handled at next cart revalidation (BR 3.6).
- Stock restored from 0 (cancellation) → product automatically becomes purchasable again; no manual step.
- ARCHIVED product with stock > 0: stays archived; stock is retained but not sellable.
