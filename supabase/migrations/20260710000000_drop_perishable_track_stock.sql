-- Remove unused columns is_perishable, track_stock and stock_max from products
ALTER TABLE products DROP COLUMN IF EXISTS is_perishable;
ALTER TABLE products DROP COLUMN IF EXISTS track_stock;
ALTER TABLE products DROP COLUMN IF EXISTS stock_max;
