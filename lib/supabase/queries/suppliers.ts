import { createClient } from "@/lib/supabase/client";

export interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  logo_url: string | null;
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

/** Statistiques d'achat renvoyees par la RPC get_suppliers_with_stats */
export interface SupplierStats {
  product_count: number;
  alert_count: number;
  total_purchased: number;
  last_purchase_at: string | null;
  invoice_count: number;
}

export interface SupplierWithStats extends SupplierWithProducts, SupplierStats {}

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
 * Fournisseurs avec leurs produits ET leurs statistiques d'achat.
 *
 * Deux appels en parallèle plutôt qu'un seul : la RPC agrège (dépense, dernier
 * achat, alertes) mais ne peut pas renvoyer proprement la liste imbriquée des
 * produits, dont on a besoin pour les icônes des cartes.
 */
export async function getSuppliersWithStats(organizationId: string): Promise<SupplierWithStats[]> {
  const supabase = createClient();

  const [withProducts, statsResult] = await Promise.all([
    getSuppliersWithProducts(organizationId),
    supabase.rpc("get_suppliers_with_stats", { p_organization_id: organizationId }),
  ]);

  if (statsResult.error) {
    throw new Error(
      `Erreur lors de la récupération des statistiques fournisseurs: ${statsResult.error.message}`
    );
  }

  const statsById = new Map<string, SupplierStats>();
  for (const row of statsResult.data ?? []) {
    statsById.set(row.id, {
      // Postgres renvoie bigint et numeric en chaîne : sans Number(), les tris
      // et les totaux se feraient en comparaison de texte ("9" > "10").
      product_count: Number(row.product_count ?? 0),
      alert_count: Number(row.alert_count ?? 0),
      total_purchased: Number(row.total_purchased ?? 0),
      last_purchase_at: row.last_purchase_at,
      invoice_count: Number(row.invoice_count ?? 0),
    });
  }

  return withProducts.map((s) => ({
    ...s,
    ...(statsById.get(s.id) ?? {
      product_count: s.products.length,
      alert_count: 0,
      total_purchased: 0,
      last_purchase_at: null,
      invoice_count: 0,
    }),
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
 * Televerse un logo de fournisseur.
 *
 * Reutilise le bucket public "product-images" sous le prefixe suppliers/ :
 * ses policies portent sur le bucket entier, sans restriction de chemin.
 */
export async function uploadSupplierLogo(file: File): Promise<string> {
  const supabase = createClient();

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `suppliers/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    throw new Error(`Erreur lors de l'upload du logo: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Crée un nouveau fournisseur
 */
export async function createSupplier(
  organizationId: string,
  name: string,
  websiteUrl?: string | null,
  email?: string | null,
  phone?: string | null,
  logoUrl?: string | null
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
      logo_url: logoUrl || null,
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
    logo_url?: string | null;
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
