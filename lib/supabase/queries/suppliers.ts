import { createClient } from "@/lib/supabase/client";

export interface Supplier {
  id: string;
  name: string;
  website_url: string | null;
  organization_id: string | null;
  created_at: string | null;
}

/**
 * Récupère tous les fournisseurs
 */
export async function getSuppliers(organizationId?: string): Promise<Supplier[]> {
  const supabase = createClient();

  let query = supabase
    .from("suppliers")
    .select("*")
    .order("name", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des fournisseurs: ${error.message}`);
  }

  return data || [];
}

/**
 * Crée un nouveau fournisseur
 */
export async function createSupplier(
  organizationId: string,
  name: string,
  websiteUrl?: string | null
): Promise<Supplier> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      organization_id: organizationId,
      name,
      website_url: websiteUrl || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur lors de la création du fournisseur: ${error.message}`);
  }

  return data;
}

/**
 * Met à jour un fournisseur existant
 */
export async function updateSupplier(
  id: string,
  data: { name?: string; website_url?: string | null }
): Promise<Supplier> {
  const supabase = createClient();

  const { data: supplier, error } = await supabase
    .from("suppliers")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur lors de la mise à jour du fournisseur: ${error.message}`);
  }

  return supplier;
}

/**
 * Supprime un fournisseur (vérifie qu'aucun produit ne le référence)
 */
export async function deleteSupplier(id: string): Promise<void> {
  const supabase = createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id")
    .eq("supplier_id", id)
    .limit(1);

  if (products && products.length > 0) {
    throw new Error("Impossible de supprimer un fournisseur utilisé par des produits");
  }

  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la suppression du fournisseur: ${error.message}`);
  }
}
