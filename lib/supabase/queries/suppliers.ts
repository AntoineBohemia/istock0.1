import { createClient } from "@/lib/supabase/client";

export interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  organization_id: string | null;
  created_at: string | null;
}

export interface SupplierProduct {
  id: string;
  name: string;
  stock_current: number | null;
  stock_min: number | null;
  icon_name: string | null;
  icon_color: string | null;
  image_url: string | null;
  archived_at: string | null;
}

export interface SupplierWithProducts extends Supplier {
  products: SupplierProduct[];
}

/**
 * Récupère tous les fournisseurs
 */
export async function getSuppliers(organizationId?: string): Promise<Supplier[]> {
  const supabase = createClient();

  let query = supabase.from("suppliers").select("*").order("name", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des fournisseurs: ${error.message}`);
  }

  return (data as Supplier[]) || [];
}

/**
 * Récupère tous les fournisseurs avec leurs produits liés
 */
export async function getSuppliersWithProducts(
  organizationId: string
): Promise<SupplierWithProducts[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("suppliers")
    .select(
      "*, products:products(id, name, stock_current, stock_min, icon_name, icon_color, image_url, archived_at)"
    )
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération des fournisseurs: ${error.message}`);
  }

  return (data ?? []).map((s) => ({
    ...(s as unknown as Supplier),
    products: (((s as Record<string, unknown>).products as SupplierProduct[]) ?? []).filter(
      (p) => !p.archived_at
    ),
  }));
}

/**
 * Récupère un fournisseur par ID avec ses produits
 */
export async function getSupplier(id: string): Promise<SupplierWithProducts | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("suppliers")
    .select(
      "*, products:products(id, name, stock_current, stock_min, icon_name, icon_color, image_url, archived_at)"
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Erreur lors de la récupération du fournisseur: ${error.message}`);
  }

  return {
    ...(data as unknown as Supplier),
    products: (((data as Record<string, unknown>).products as SupplierProduct[]) ?? []).filter(
      (p) => !p.archived_at
    ),
  };
}

/**
 * Crée un nouveau fournisseur
 */
export async function createSupplier(
  organizationId: string,
  name: string,
  websiteUrl?: string | null,
  email?: string | null,
  phone?: string | null
): Promise<Supplier> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      organization_id: organizationId,
      name,
      website_url: websiteUrl || null,
      email: email || null,
      phone: phone || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur lors de la création du fournisseur: ${error.message}`);
  }

  return data as unknown as Supplier;
}

/**
 * Met à jour un fournisseur existant
 */
export async function updateSupplier(
  id: string,
  data: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    website_url?: string | null;
  }
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

  return supplier as unknown as Supplier;
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

  const { error } = await supabase.from("suppliers").delete().eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la suppression du fournisseur: ${error.message}`);
  }
}
