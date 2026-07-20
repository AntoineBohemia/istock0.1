import { createClient } from "@/lib/supabase/client";

/**
 * Une facture d'achat couvre plusieurs entrées de stock.
 * Le PDF vit dans le bucket privé `purchase-invoices` : on stocke son chemin,
 * et la consultation passe par un lien temporaire signé.
 */
export interface PurchaseInvoice {
  id: string;
  organization_id: string;
  supplier_id: string | null;
  reference: string;
  invoice_date: string | null;
  total_amount: number | null;
  file_path: string | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
  supplier?: { id: string; name: string } | null;
}

export interface PurchaseInvoiceWithLines extends PurchaseInvoice {
  /** Achats couverts par cette facture */
  lines: {
    id: string;
    quantity: number;
    unit_price: number | null;
    created_at: string | null;
    product: { id: string; name: string; sku: string | null } | null;
  }[];
}

export async function getPurchaseInvoices(organizationId?: string): Promise<PurchaseInvoice[]> {
  const supabase = createClient();

  let query = supabase
    .from("purchase_invoices")
    .select("*, supplier:suppliers(id, name)")
    .order("invoice_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des factures: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...row,
    supplier: Array.isArray(row.supplier) ? row.supplier[0] : row.supplier,
  })) as unknown as PurchaseInvoice[];
}

export async function getPurchaseInvoice(id: string): Promise<PurchaseInvoiceWithLines | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("purchase_invoices")
    .select("*, supplier:suppliers(id, name)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Erreur lors de la récupération de la facture: ${error.message}`);
  }

  const { data: lines, error: linesError } = await supabase
    .from("stock_movements")
    .select("id, quantity, unit_price, created_at, product:products(id, name, sku)")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false });

  if (linesError) {
    throw new Error(`Erreur lors de la récupération des achats: ${linesError.message}`);
  }

  return {
    ...(data as unknown as PurchaseInvoice),
    supplier: Array.isArray(data.supplier) ? data.supplier[0] : data.supplier,
    lines: (lines ?? []).map((l) => ({
      ...l,
      product: Array.isArray(l.product) ? l.product[0] : l.product,
    })),
  } as unknown as PurchaseInvoiceWithLines;
}

export async function createPurchaseInvoice(fields: {
  organization_id: string;
  reference: string;
  supplier_id?: string | null;
  invoice_date?: string | null;
  total_amount?: number | null;
}): Promise<PurchaseInvoice> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("purchase_invoices")
    .insert({
      organization_id: fields.organization_id,
      reference: fields.reference,
      supplier_id: fields.supplier_id || null,
      invoice_date: fields.invoice_date || null,
      total_amount: fields.total_amount ?? null,
    })
    .select("*, supplier:suppliers(id, name)")
    .single();

  if (error) {
    throw new Error(`Erreur lors de la création de la facture: ${error.message}`);
  }

  return data as unknown as PurchaseInvoice;
}

export async function updatePurchaseInvoice(
  id: string,
  fields: {
    reference?: string;
    supplier_id?: string | null;
    invoice_date?: string | null;
    total_amount?: number | null;
    file_path?: string | null;
    file_name?: string | null;
  }
): Promise<PurchaseInvoice> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("purchase_invoices")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, supplier:suppliers(id, name)")
    .single();

  if (error) {
    throw new Error(`Erreur lors de la mise à jour de la facture: ${error.message}`);
  }

  return data as unknown as PurchaseInvoice;
}

export async function deletePurchaseInvoice(id: string, filePath?: string | null): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("purchase_invoices").delete().eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la suppression de la facture: ${error.message}`);
  }

  if (filePath) {
    await supabase.storage.from("purchase-invoices").remove([filePath]);
  }
}

/**
 * Téléverse le PDF d'une facture et l'enregistre sur celle-ci.
 */
export async function uploadInvoiceFile(file: File, invoiceId: string): Promise<string> {
  const supabase = createClient();

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${invoiceId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("purchase-invoices")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    throw new Error(`Erreur lors de l'envoi de la facture: ${uploadError.message}`);
  }

  const { error: updateError } = await supabase
    .from("purchase_invoices")
    .update({ file_path: path, file_name: file.name, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);

  if (updateError) {
    // Pas de fichier orphelin si l'enregistrement échoue
    await supabase.storage.from("purchase-invoices").remove([path]);
    throw new Error(`Erreur lors de l'enregistrement du fichier: ${updateError.message}`);
  }

  return path;
}

/**
 * Achats (entrées de stock) pas encore rattachés à une facture.
 * Sert à raccrocher après coup des entrées déjà enregistrées.
 */
export async function getUnlinkedEntries(organizationId: string): Promise<
  {
    id: string;
    quantity: number;
    unit_price: number | null;
    created_at: string | null;
    product: { id: string; name: string; sku: string | null } | null;
  }[]
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_movements")
    .select("id, quantity, unit_price, created_at, product:products(id, name, sku)")
    .eq("organization_id", organizationId)
    .eq("movement_type", "entry")
    .is("invoice_id", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Erreur lors de la récupération des achats: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...row,
    product: Array.isArray(row.product) ? row.product[0] : row.product,
  })) as unknown as {
    id: string;
    quantity: number;
    unit_price: number | null;
    created_at: string | null;
    product: { id: string; name: string; sku: string | null } | null;
  }[];
}

/**
 * Lien temporaire pour consulter une facture (le bucket est privé).
 */
export async function getInvoiceSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("purchase-invoices")
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Facture indisponible: ${error?.message ?? "lien non généré"}`);
  }

  return data.signedUrl;
}
