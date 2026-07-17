-- Drop the notes column from stock_movements
ALTER TABLE stock_movements DROP COLUMN IF EXISTS notes;
