import { createClient } from "@/lib/supabase/client";

/** Bucket prive : le fichier ne s'ouvre que par lien signe temporaire. */
const BUCKET = "purchase-invoices";

/**
 * Une facture d'achat.
 *
 * Elle appartient au fournisseur, pas au produit : une meme facture couvre
 * plusieurs entrees de stock. La table et le bucket existaient depuis juillet
 * sans qu'aucun ecran ne permette d'en creer une.
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
}

export interface PurchaseInvoiceInput {
  reference: string;
  invoiceDate?: string | null;
  totalAmount?: number | null;
  file?: File | null;
}

/** Factures d'un fournisseur, de la plus recente a la plus ancienne. */
export async function getSupplierInvoices(supplierId: string): Promise<PurchaseInvoice[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("purchase_invoices")
    .select("*")
    .eq("supplier_id", supplierId)
    // Une facture sans date reste visible : `nullsFirst: false` la renvoie en
    // fin de liste au lieu de la faire passer devant les plus recentes.
    .order("invoice_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erreur lors de la recuperation des factures: ${error.message}`);
  }

  return (data ?? []) as unknown as PurchaseInvoice[];
}

export async function createPurchaseInvoice(
  organizationId: string,
  supplierId: string,
  input: PurchaseInvoiceInput
): Promise<PurchaseInvoice> {
  const supabase = createClient();

  let filePath: string | null = null;
  let fileName: string | null = null;

  if (input.file) {
    const ext = input.file.name.split(".").pop()?.toLowerCase() || "pdf";
    filePath = `${organizationId}/${supplierId}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, input.file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      throw new Error(`Erreur lors de l'envoi du fichier: ${uploadError.message}`);
    }
    fileName = input.file.name;
  }

  const { data, error } = await supabase
    .from("purchase_invoices")
    .insert({
      organization_id: organizationId,
      supplier_id: supplierId,
      reference: input.reference.trim(),
      invoice_date: input.invoiceDate || null,
      total_amount: input.totalAmount ?? null,
      file_path: filePath,
      file_name: fileName,
    })
    .select()
    .single();

  if (error) {
    // Le fichier est deja dans le bucket : sans ce nettoyage il y resterait
    // sans aucune ligne pour le retrouver.
    if (filePath) {
      await supabase.storage.from(BUCKET).remove([filePath]);
    }
    throw new Error(`Erreur lors de l'enregistrement de la facture: ${error.message}`);
  }

  return data as unknown as PurchaseInvoice;
}

export async function deletePurchaseInvoice(id: string, filePath: string | null): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("purchase_invoices").delete().eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la suppression: ${error.message}`);
  }

  // Le fichier apres la ligne : si la suppression du fichier echoue, on perd
  // un document orphelin, pas la trace comptable.
  if (filePath) {
    await supabase.storage.from(BUCKET).remove([filePath]);
  }
}

/**
 * Lien temporaire vers le document.
 *
 * Le bucket est prive : une URL publique n'existe pas, il faut la demander a
 * chaque ouverture.
 */
export async function getInvoiceFileUrl(filePath: string): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60);

  if (error || !data) {
    throw new Error(`Erreur lors de l'ouverture du document: ${error?.message ?? "inconnue"}`);
  }

  return data.signedUrl;
}
