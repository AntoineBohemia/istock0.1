import {
  createPurchaseInvoice,
  updatePurchaseInvoice,
  uploadInvoiceFile,
} from "./purchase-invoices";
import { linkMovementToInvoice } from "./stock-movements";

/**
 * Rattache un PDF de facture a un mouvement d'entree, en une fois.
 *
 * Rattacher une facture demandait auparavant de la creer d'abord depuis la
 * page Factures, puis de revenir la selectionner. Ici on part du fichier :
 * la facture est creee, le PDF televerse, et le mouvement rattache.
 *
 * La reference est deduite du nom du fichier si l'utilisateur n'en donne pas —
 * « FA-2026-118.pdf » vaut mieux qu'un identifiant technique dans la liste.
 */
export async function attachInvoiceFileToMovement(params: {
  file: File;
  movementId: string;
  organizationId: string;
  supplierId?: string | null;
  invoiceDate?: string | null;
  totalAmount?: number | null;
  reference?: string | null;
}): Promise<{ invoiceId: string }> {
  const { file, movementId, organizationId, supplierId, invoiceDate, totalAmount } = params;

  const reference =
    params.reference?.trim() ||
    // Nom du fichier sans son extension
    file.name.replace(/\.[^.]+$/, "").slice(0, 120);

  const invoice = await createPurchaseInvoice({
    organization_id: organizationId,
    reference,
    supplier_id: supplierId ?? null,
    invoice_date: invoiceDate ?? null,
    total_amount: totalAmount ?? null,
  });

  try {
    const path = await uploadInvoiceFile(file, invoice.id);
    await updatePurchaseInvoice(invoice.id, { file_path: path, file_name: file.name });
  } catch (err) {
    // La facture existe deja : on la laisse, elle reste completable a la main
    // plutot que de perdre le rattachement du mouvement.
    await linkMovementToInvoice(movementId, invoice.id);
    throw err;
  }

  await linkMovementToInvoice(movementId, invoice.id);

  return { invoiceId: invoice.id };
}
