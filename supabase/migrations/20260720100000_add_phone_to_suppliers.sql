-- Add a phone number to suppliers so it can be shown next to the order email
-- in the "Produits à commander" modal (call the supplier instead of mailing).

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone TEXT;
