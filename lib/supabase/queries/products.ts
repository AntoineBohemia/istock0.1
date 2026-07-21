import { createClient } from "@/lib/supabase/client";
import { Category } from "./categories";
import { Supplier } from "./suppliers";

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  icon_name: string | null;
  icon_color: string | null;
  image_url: string | null;
  /** Lien web de l'article (page fournisseur ou fabricant) */
  product_url: string | null;
  price: number | null;
  stock_current: number | null;
  stock_min: number | null;
  category_id: string | null;
  supplier_id: string | null;
  organization_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
  /** "consumable" ou "equipment" — l'outillage ne compte pas dans les totaux */
  product_type?: "consumable" | "equipment";
}

export interface ProductOrgStock {
  organization_id: string;
  stock_current: number;
  organization?: { name: string } | null;
}

export interface ProductWithRelations extends Product {
  category?: Category | null;
  supplier?: Supplier | null;
  product_organization_stock?: ProductOrgStock[];
}

export interface ProductFilters {
  organizationId?: string;
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  stockStatus?: "low" | "normal" | "high" | "all";
  /**
   * Inclure l'outillage. Par defaut la liste ne montre que les consommables
   * (l'outillage a sa propre page), mais l'entree de stock et le tableau des
   * achats doivent pouvoir le traiter.
   */
  includeEquipment?: boolean;
}

export interface ProductsResult {
  products: ProductWithRelations[];
  total: number;
}

export interface CreateProductData {
  organization_id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  icon_name?: string | null;
  icon_color?: string | null;
  image_url?: string | null;
  product_url?: string | null;
  price?: number | null;
  stock_current?: number;
  stock_min?: number;
  category_id?: string | null;
  supplier_id?: string | null;
}

export type UpdateProductData = Partial<CreateProductData>;

/**
 * Génère un SKU automatique basé sur le nom et un timestamp
 */
export function generateSKU(name: string): string {
  const prefix = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 4)
    .padEnd(4, "X");
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  return `${prefix}-${timestamp}`;
}

/**
 * Récupère la liste des produits avec filtres et pagination
 */
export async function getProducts(filters: ProductFilters = {}): Promise<ProductsResult> {
  const supabase = createClient();
  const { organizationId, search, categoryId, minPrice, maxPrice, stockStatus, includeEquipment } =
    filters;

  // Construire la requête de base
  // count: "exact" — le catalogue (53 references, environ 4 par mois) est loin
  // du plafond de 1000 lignes de Supabase, mais un total tire de data.length
  // vaudrait la limite le jour ou elle serait atteinte, sans rien signaler.
  // Ici le compte vient du serveur : une troncature deviendrait visible.
  let query = supabase
    .from("products")
    .select(
      "*, category:categories(*), supplier:suppliers(*), product_organization_stock(organization_id, stock_current, organization:organizations(name))",
      { count: "exact" }
    );

  // Archives toujours exclus. Outillage exclu par defaut : il a sa page.
  query = query.is("archived_at", null);
  if (!includeEquipment) {
    query = query.eq("product_type", "consumable");
  }

  // Filtrer par organisation
  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  // Appliquer les filtres
  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (minPrice !== undefined) {
    query = query.gte("price", minPrice);
  }

  if (maxPrice !== undefined) {
    query = query.lte("price", maxPrice);
  }

  // Note: stockStatus "low"/"high" filters are applied client-side after fetch
  // because PostgREST doesn't support column-to-column comparison directly

  query = query.order("created_at", { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des produits: ${error.message}`);
  }

  let products = (data as ProductWithRelations[]) || [];

  // Apply stock status filter client-side (column-to-column comparison)
  if (stockStatus && stockStatus !== "all") {
    if (stockStatus === "low") {
      products = products.filter((p) => (p.stock_current ?? 0) <= (p.stock_min ?? 0));
    }
  }

  return {
    products,
    // Le filtre « stock bas » s'applique apres coup : dans ce cas seul le
    // tableau filtre fait foi, le compte serveur porterait sur l'avant-filtre.
    total: stockStatus && stockStatus !== "all" ? products.length : (count ?? products.length),
  };
}

/**
 * Récupère un produit par son ID avec sa catégorie
 */
export async function getProduct(id: string): Promise<ProductWithRelations | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "*, category:categories(*), supplier:suppliers(*), product_organization_stock(organization_id, stock_current, organization:organizations(name))"
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Erreur lors de la récupération du produit: ${error.message}`);
  }

  return data as ProductWithRelations;
}

/**
 * Crée un nouveau produit
 */
export async function createProduct(data: CreateProductData): Promise<Product> {
  const supabase = createClient();

  // Générer un SKU si non fourni
  const sku = data.sku || generateSKU(data.name);

  const productData = {
    organization_id: data.organization_id,
    name: data.name,
    sku,
    description: data.description || null,
    icon_name: data.icon_name || null,
    icon_color: data.icon_color || null,
    image_url: data.image_url || null,
    product_url: data.product_url || null,
    price: data.price ?? null,
    stock_current: data.stock_current ?? 0,
    stock_min: data.stock_min ?? 10,
    category_id: data.category_id || null,
    supplier_id: data.supplier_id || null,
    product_type: ((data as any).product_type as "consumable" | "equipment") || "consumable",
  };

  const { data: product, error } = await supabase
    .from("products")
    .insert(productData)
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur lors de la création du produit: ${error.message}`);
  }

  return product;
}

/**
 * Met à jour un produit existant
 */
export async function updateProduct(
  id: string,
  data: UpdateProductData,
  organizationId?: string
): Promise<Product> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.icon_name !== undefined) updateData.icon_name = data.icon_name;
  if (data.icon_color !== undefined) updateData.icon_color = data.icon_color;
  if (data.image_url !== undefined) updateData.image_url = data.image_url;
  if (data.product_url !== undefined) updateData.product_url = data.product_url || null;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.stock_current !== undefined) updateData.stock_current = data.stock_current;
  if (data.stock_min !== undefined) updateData.stock_min = data.stock_min;
  if (data.category_id !== undefined) updateData.category_id = data.category_id;
  if (data.supplier_id !== undefined) updateData.supplier_id = data.supplier_id;
  let query = supabase.from("products").update(updateData).eq("id", id);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data: product, error } = await query.select().single();

  if (error) {
    throw new Error(`Erreur lors de la mise à jour du produit: ${error.message}`);
  }

  return product;
}

/**
 * Archive un produit (soft-delete)
 */
/**
 * Restaure un produit archive.
 *
 * L'archivage existait sans son inverse : un clic mettait le produit hors de
 * portee definitivement depuis l'interface.
 */
export async function unarchiveProduct(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("products").update({ archived_at: null }).eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la restauration du produit: ${error.message}`);
  }
}

export async function archiveProduct(id: string, organizationId?: string): Promise<void> {
  const supabase = createClient();

  let query = supabase
    .from("products")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Erreur lors de l'archivage du produit: ${error.message}`);
  }
}

/**
 * Upload une image de produit vers Supabase Storage
 */
export async function uploadProductImage(file: File): Promise<string> {
  const supabase = createClient();

  // Générer un nom de fichier unique
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Erreur lors de l'upload de l'image: ${uploadError.message}`);
  }

  // Obtenir l'URL publique
  const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Supprime une image de produit de Supabase Storage
 */
export async function deleteProductImage(imageUrl: string): Promise<void> {
  const supabase = createClient();

  // Extraire le chemin du fichier depuis l'URL
  const url = new URL(imageUrl);
  const pathParts = url.pathname.split("/product-images/");
  if (pathParts.length < 2) return;

  const filePath = pathParts[1];

  const { error } = await supabase.storage.from("product-images").remove([filePath]);

  if (error) {
    console.error("Erreur lors de la suppression de l'image:", error);
  }
}

/**
 * Récupère les statistiques des produits
 */
export async function getProductsStats(organizationId?: string): Promise<{
  total: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
}> {
  const supabase = createClient();

  let query = supabase
    .from("products")
    .select("stock_current, stock_min, price")
    .is("archived_at", null);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des statistiques: ${error.message}`);
  }

  const products = data || [];
  const total = products.length;
  const lowStock = products.filter(
    (p) => (p.stock_current ?? 0) <= (p.stock_min ?? 0) && (p.stock_current ?? 0) > 0
  ).length;
  const outOfStock = products.filter((p) => (p.stock_current ?? 0) === 0).length;
  const totalValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock_current ?? 0), 0);

  return { total, lowStock, outOfStock, totalValue };
}
