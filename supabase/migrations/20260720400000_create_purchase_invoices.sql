-- ============================================================
-- Table: purchase_invoices
-- Une facture d'achat est un document a part entiere : elle a son
-- fournisseur, sa date, son numero, son montant et son PDF — et elle
-- couvre PLUSIEURS achats (entrees de stock).
--
-- Remplace l'approche precedente (un fichier par entree), qui obligeait
-- a televerser le meme PDF autant de fois qu'il y avait de produits.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,

  reference       TEXT NOT NULL,
  invoice_date    DATE,
  total_amount    NUMERIC,

  -- Chemin dans le bucket prive purchase-invoices (pas une URL publique)
  file_path       TEXT,
  file_name       TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_org      ON public.purchase_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON public.purchase_invoices(supplier_id);

-- Lien facture -> achats. Une facture couvre plusieurs mouvements d'entree.
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.purchase_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_invoice ON public.stock_movements(invoice_id);

-- L'ancienne approche (un fichier par entree) est abandonnee.
-- Aucune donnee n'y a ete enregistree : suppression sans perte.
ALTER TABLE stock_movements DROP COLUMN IF EXISTS invoice_path;

-- ============================================================
-- RLS — meme regle que stock_movements : acces limite aux
-- organisations dont l'utilisateur est membre.
-- ============================================================
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their organization purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Users can access their organization purchase_invoices"
  ON public.purchase_invoices
  FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids()));
