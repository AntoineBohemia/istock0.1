import { createClient } from "@/lib/supabase/client";
import { Category } from "./categories";

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  stock_current: number | null;
  stock_min: number | null;
  stock_max: number | null;
  category_id: string | null;
  supplier_name: string | null;
  is_perishable: boolean | null;
  track_stock: boolean | null;
  organization_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
}

export interface ProductWithCategory extends Product {
  category?: Category | null;
}

export interface ProductFilters {
  organizationId?: string;
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  stockStatus?: "low" | "normal" | "high" | "all";
  page?: number;
  pageSize?: number;
}

export interface ProductsResult {
  products: ProductWithCategory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateProductData {
  organization_id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  image_url?: string | null;
  price?: number | null;
  stock_current?: number;
  stock_min?: number;
  stock_max?: number;
  category_id?: string | null;
  supplier_name?: string | null;
  is_perishable?: boolean;
  track_stock?: boolean;
}

export interface UpdateProductData extends Partial<CreateProductData> {}

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
export async function getProducts(
  filters: ProductFilters = {}
): Promise<ProductsResult> {
  const supabase = createClient();
  const {
    organizationId,
    search,
    categoryId,
    minPrice,
    maxPrice,
    stockStatus,
    page = 1,
    pageSize = 10,
  } = filters;

  // Construire la requête de base
  let query = supabase
    .from("products")
    .select("*, category:categories(*)", { count: "exact" });

  // Filtrer par organisation
  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  // Appliquer les filtres
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`
    );
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

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des produits: ${error.message}`);
  }

  let products = (data as ProductWithCategory[]) || [];
  let total = count || 0;

  // Apply stock status filter client-side (column-to-column comparison)
  if (stockStatus && stockStatus !== "all") {
    if (stockStatus === "low") {
      products = products.filter((p) => (p.stock_current ?? 0) <= (p.stock_min ?? 0));
    } else if (stockStatus === "high") {
      products = products.filter((p) => (p.stock_current ?? 0) >= (p.stock_max ?? 0));
    }
    total = products.length;
  }

  return {
    products,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Récupère un produit par son ID avec sa catégorie
 */
export async function getProduct(id: string): Promise<ProductWithCategory | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Erreur lors de la récupération du produit: ${error.message}`);
  }

  return data as ProductWithCategory;
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
    image_url: data.image_url || null,
    price: data.price ?? null,
    stock_current: data.stock_current ?? 0,
    stock_min: data.stock_min ?? 10,
    stock_max: data.stock_max ?? 100,
    category_id: data.category_id || null,
    supplier_name: data.supplier_name || null,
    is_perishable: data.is_perishable ?? false,
    track_stock: data.track_stock ?? true,
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
  data: UpdateProductData
): Promise<Product> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Ajouter uniquement les champs définis
  if (data.name !== undefined) updateData.name = data.name;
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.image_url !== undefined) updateData.image_url = data.image_url;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.stock_current !== undefined) updateData.stock_current = data.stock_current;
  if (data.stock_min !== undefined) updateData.stock_min = data.stock_min;
  if (data.stock_max !== undefined) updateData.stock_max = data.stock_max;
  if (data.category_id !== undefined) updateData.category_id = data.category_id;
  if (data.supplier_name !== undefined) updateData.supplier_name = data.supplier_name;
  if (data.is_perishable !== undefined) updateData.is_perishable = data.is_perishable;
  if (data.track_stock !== undefined) updateData.track_stock = data.track_stock;

  const { data: product, error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur lors de la mise à jour du produit: ${error.message}`);
  }

  return product;
}

/**
 * Supprime un produit
 */
export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la suppression du produit: ${error.message}`);
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
  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(filePath);

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

  const { error } = await supabase.storage
    .from("product-images")
    .remove([filePath]);

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
    .select("stock_current, stock_min, price");

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
  const totalValue = products.reduce(
    (sum, p) => sum + (p.price || 0) * (p.stock_current ?? 0),
    0
  );

  return { total, lowStock, outOfStock, totalValue };
}
