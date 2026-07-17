-- Add email column to suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS email text;
