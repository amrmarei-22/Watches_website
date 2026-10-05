-- Run ONCE in the Supabase SQL Editor if you already ran the old seed.sql (updates the sample images only).
update public.product_images pi
set path = '/placeholders/sample-dial-' || (((substr(p.sku, 8)::int - 1) % 6) + 1) || '.svg'
from public.products p
where p.id = pi.product_id and p.sku like 'SAMPLE-%';
