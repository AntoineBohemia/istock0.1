-- Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  website_url text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- RLS policies (idempotent: drop then create)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view suppliers in their organizations" ON public.suppliers;
CREATE POLICY "Users can view suppliers in their organizations"
  ON public.suppliers FOR SELECT
  USING (organization_id IN (SELECT get_user_organization_ids()));

DROP POLICY IF EXISTS "Users can insert suppliers in their organizations" ON public.suppliers;
CREATE POLICY "Users can insert suppliers in their organizations"
  ON public.suppliers FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids()));

DROP POLICY IF EXISTS "Users can update suppliers in their organizations" ON public.suppliers;
CREATE POLICY "Users can update suppliers in their organizations"
  ON public.suppliers FOR UPDATE
  USING (organization_id IN (SELECT get_user_organization_ids()));

DROP POLICY IF EXISTS "Users can delete suppliers in their organizations" ON public.suppliers;
CREATE POLICY "Users can delete suppliers in their organizations"
  ON public.suppliers FOR DELETE
  USING (organization_id IN (SELECT get_user_organization_ids()));

-- Add supplier_id column to products (IF NOT EXISTS via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE public.products ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Migrate existing supplier_name data into suppliers table (only if supplier_name column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'supplier_name'
  ) THEN
    -- Insert distinct supplier names into suppliers table (avoid duplicates)
    INSERT INTO public.suppliers (name, organization_id)
    SELECT DISTINCT p.supplier_name, p.organization_id
    FROM public.products p
    WHERE p.supplier_name IS NOT NULL AND p.supplier_name != ''
      AND NOT EXISTS (
        SELECT 1 FROM public.suppliers s
        WHERE s.name = p.supplier_name AND s.organization_id = p.organization_id
      );

    -- Populate supplier_id from the newly created suppliers
    UPDATE public.products p
    SET supplier_id = s.id
    FROM public.suppliers s
    WHERE p.supplier_name = s.name
      AND p.organization_id = s.organization_id
      AND p.supplier_id IS NULL;

    -- Drop the old supplier_name column
    ALTER TABLE public.products DROP COLUMN supplier_name;
  END IF;
END $$;
