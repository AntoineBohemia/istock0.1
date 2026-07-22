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
  /**
   * Total toutes societes confondues.
   *
   * `stock_current` porte le stock de la societe consultee ; ce champ garde le
   * cumul pour les rares ecrans qui l'assument (valeur du patrimoine, achats
   * consolides). Absent quand aucune societe n'est precisee — `stock_current`
   * vaut alors deja le total.
   */
  stock_all_organizations?: number;
}

export interface ProductFilters {
  /**
   * Societe consultee.
   *
   * Deux roles distincts, a ne pas confondre : elle conditionne le
   * declenchement de la requete (les hooks attendent qu'une societe soit
   * connue) et elle designe le stock a exposer. Elle ne filtre plus les
   * fiches — le catalogue est commun.
   */
  organizationId?: string;
  /**
   * Quel stock afficher.
   *
   * « organization » (defaut) : le stock de la societe consultee — pour les
   * ecrans qui font agir, ou le nombre annonce doit etre celui dans lequel on
   * puise reellement.
   * « all » : le total toutes societes — pour les ecrans de consultation.
   */
  stockScope?: "organization" | "all";
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
  /**
   * Ignore a la creation : le stock ne s'ecrit que par un mouvement d'entree.
   * Conserve pour ne pas casser les appelants, mais sans effet.
   *
   * @deprecated Enregistrer une entree apres la creation.
   */
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
  const {
    organizationId,
    stockScope = "organization",
    search,
    categoryId,
    minPrice,
    maxPrice,
    stockStatus,
    includeEquipment,
  } = filters;

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

  // Le catalogue est commun aux societes du compte : la meme peinture sert a
  // SMPR comme a SEIREN, seul le stock est tenu separement. On ne filtre donc
  // plus sur products.organization_id, qui ne designe que la societe ayant
  // cree la fiche — filtrer dessus rendait le catalogue vide pour toute
  // societe n'ayant jamais cree de produit. La RLS limite deja la visibilite
  // aux societes de l'utilisateur.
  //
  // `organizationId` sert desormais a choisir QUEL stock est expose, plus
  // bas, et non quelles fiches sont visibles.

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

  // Le stock expose est celui de la societe consultee.
  //
  // `products.stock_current` est un cache du total toutes societes. Une
  // trentaine d'ecrans le lisent pour afficher « le stock » : ils montraient
  // donc 1830 unites a SEIREN qui n'en detient que 44, et les seuils, scores,
  // alertes de rupture et valeurs en euros en decoulaient tous. Substituer ici
  // les corrige d'un seul coup.
  //
  // L'outillage est laisse tel quel : il est volontairement hors ventilation
  // par societe (migration 20260721900000), ses lignes par societe ont ete
  // supprimees et le remplacer le mettrait a zero.
  if (organizationId && stockScope === "organization") {
    products = products.map((p) => {
      if (p.product_type === "equipment") return p;
      const own = p.product_organization_stock?.find(
        (pos) => pos.organization_id === organizationId
      );
      return {
        ...p,
        stock_current: own?.stock_current ?? 0,
        // Le total reste accessible aux ecrans qui l'assument, plutot que de
        // les obliger a resommer la ventilation.
        stock_all_organizations: p.stock_current ?? 0,
      };
    });
  }

  // Apply stock status filter client-side (column-to-column comparison)
  // Applique apres la substitution : un « stock bas » se juge sur le stock de
  // la societe, pas sur le total.
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
    // Toujours zero. Un stock ne s'ecrit que par un mouvement d'entree, qui
    // seul alimente aussi product_organization_stock.
    //
    // Ecrire une quantite ici creait un produit dont le total global etait
    // renseigne alors qu'aucune societe n'en detenait rien et qu'aucun
    // mouvement ne l'expliquait. C'est l'origine des 25 unites fantomes de
    // « Test Peinture iStock » : 37 au cache, 12 chez les societes.
    //
    // L'appelant qui veut un stock de depart enregistre une entree apres la
    // creation — c'est deja ce que fait la creation d'outillage.
    stock_current: 0,
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

  // Le motif décrit une sortie du catalogue : il n'a plus de sens sur un
  // produit qui y revient, et le garder ferait mentir le prochain archivage.
  const { error } = await supabase
    .from("products")
    .update({ archived_at: null, archive_reason: null })
    .eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la restauration du produit: ${error.message}`);
  }
}

export async function archiveProduct(
  id: string,
  options?: { reason?: string; organizationId?: string }
): Promise<void> {
  const supabase = createClient();

  const { reason, organizationId } = options ?? {};

  let query = supabase
    .from("products")
    .update({
      archived_at: new Date().toISOString(),
      archive_reason: reason?.trim() || null,
    })
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
