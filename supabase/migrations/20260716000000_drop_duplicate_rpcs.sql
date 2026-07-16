-- Drop duplicate/old overloads that cause PostgREST ambiguity errors

-- Old create_stock_entry with p_notes parameter (replaced by version without p_notes)
DROP FUNCTION IF EXISTS public.create_stock_entry(uuid, uuid, integer, text, uuid, numeric);

-- Old restock_technician with individual params (replaced by version with p_items jsonb)
DROP FUNCTION IF EXISTS public.restock_technician(uuid, uuid, integer, uuid);
