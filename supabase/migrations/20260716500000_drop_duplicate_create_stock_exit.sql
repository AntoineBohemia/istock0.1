-- Drop old create_stock_exit overload with p_notes parameter that causes PostgREST ambiguity
DROP FUNCTION IF EXISTS public.create_stock_exit(uuid, uuid, integer, text, uuid, text);
