import { createClient } from "@/lib/supabase/client";

export interface EquipmentAssignment {
  id: string;
  product_id: string;
  technician_id: string;
  quantity: number;
  assigned_at: string;
  organization_id: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
    icon_name: string | null;
    icon_color: string | null;
    image_url: string | null;
    price: number | null;
    stock_current: number | null;
    stock_min: number | null;
  };
  technician?: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  };
}

export interface EquipmentProduct {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  icon_name: string | null;
  icon_color: string | null;
  image_url: string | null;
  price: number | null;
  stock_current: number | null;
  stock_min: number | null;
  supplier_id: string | null;
  organization_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
  /** Motif saisi a l'archivage. Null tant que l'outil est au catalogue. */
  archive_reason: string | null;
  product_type: "equipment";
  supplier?: { id: string; name: string } | null;
  assignments: EquipmentAssignment[];
  total_assigned: number;
  /**
   * Ce que detient chaque societe.
   *
   * Necessaire pour retirer des unites : une sortie puise dans une seule
   * societe, celle qui en a le moins. Sans la ventilation, la fiche ne
   * saurait pas ou prendre.
   */
  product_organization_stock?: { organization_id: string; stock_current: number }[] | null;
}

export interface EquipmentFilters {
  organizationId?: string;
  search?: string;
  /** Afficher les outils archives au lieu des actifs */
  archived?: boolean;
}

/**
 * List all equipment products with their assignments
 */
export async function getEquipmentProducts(
  filters: EquipmentFilters = {}
): Promise<EquipmentProduct[]> {
  const supabase = createClient();
  const { organizationId, search, archived = false } = filters;

  let query = supabase
    .from("products")
    .select(
      `
      *,
      supplier:suppliers(id, name)
    `
    )
    .eq("product_type", "equipment")
    .order("name", { ascending: true });

  // Actifs par defaut ; la vue « archives » sert a restaurer un outil retire
  // par erreur — sans elle, l'archivage etait sans retour.
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
  }

  const { data: products, error } = await query;
  if (error) {
    throw new Error(`Erreur lors de la recuperation de l'outillage: ${error.message}`);
  }

  if (!products || products.length === 0) return [];

  // Fetch all assignments for these products
  const productIds = products.map((p) => p.id);
  const { data: assignments, error: assignError } = await supabase
    .from("equipment_assignments")
    .select(
      `
      *,
      technician:technicians(id, first_name, last_name, photo_url)
    `
    )
    .in("product_id", productIds);

  if (assignError) {
    throw new Error(`Erreur lors de la recuperation des assignations: ${assignError.message}`);
  }

  // Group assignments by product
  const assignmentsByProduct = new Map<string, EquipmentAssignment[]>();
  for (const a of assignments || []) {
    const normalized = {
      ...a,
      technician: Array.isArray(a.technician) ? a.technician[0] : a.technician,
    } as EquipmentAssignment;
    const list = assignmentsByProduct.get(a.product_id) || [];
    list.push(normalized);
    assignmentsByProduct.set(a.product_id, list);
  }

  return products.map((p) => {
    const prodAssignments = assignmentsByProduct.get(p.id) || [];
    return {
      ...p,
      supplier: Array.isArray(p.supplier) ? p.supplier[0] : p.supplier,
      assignments: prodAssignments,
      total_assigned: prodAssignments.reduce((sum, a) => sum + a.quantity, 0),
    } as EquipmentProduct;
  });
}

/**
 * Get a single equipment product with assignments
 */
export async function getEquipmentProduct(id: string): Promise<EquipmentProduct | null> {
  const supabase = createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select(
      `
      *,
      supplier:suppliers(id, name),
      product_organization_stock(organization_id, stock_current)
    `
    )
    .eq("id", id)
    .eq("product_type", "equipment")
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Erreur: ${error.message}`);
  }

  const { data: assignments } = await supabase
    .from("equipment_assignments")
    .select(
      `
      *,
      technician:technicians(id, first_name, last_name, photo_url)
    `
    )
    .eq("product_id", id);

  const normalizedAssignments = (assignments || []).map((a) => ({
    ...a,
    technician: Array.isArray(a.technician) ? a.technician[0] : a.technician,
  })) as EquipmentAssignment[];

  return {
    ...product,
    supplier: Array.isArray(product.supplier) ? product.supplier[0] : product.supplier,
    assignments: normalizedAssignments,
    total_assigned: normalizedAssignments.reduce((sum, a) => sum + a.quantity, 0),
  } as EquipmentProduct;
}

/**
 * Get equipment assigned to a specific technician
 */
export async function getTechnicianEquipment(technicianId: string): Promise<EquipmentAssignment[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("equipment_assignments")
    .select(
      `
      *,
      product:products(id, name, sku, icon_name, icon_color, image_url, price, stock_current, stock_min)
    `
    )
    .eq("technician_id", technicianId)
    .order("assigned_at", { ascending: false });

  if (error) {
    throw new Error(`Erreur: ${error.message}`);
  }

  return (data || []).map((a) => ({
    ...a,
    product: Array.isArray(a.product) ? a.product[0] : a.product,
  })) as EquipmentAssignment[];
}

export interface EquipmentHistoryEntry {
  id: string;
  movement_type: "assign_equipment" | "unassign_equipment";
  quantity: number;
  created_at: string | null;
  technician: { id: string; first_name: string; last_name: string } | null;
}

/**
 * Historique des assignations et retours d'un outil.
 * Répond à « qui a eu cet outil, et quand ? » — les mouvements sont déjà
 * enregistrés, ils n'étaient simplement affichés nulle part.
 */
export async function getEquipmentHistory(
  productId: string,
  limit = 30
): Promise<EquipmentHistoryEntry[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      "id, movement_type, quantity, created_at, technician:technicians(id, first_name, last_name)"
    )
    .eq("product_id", productId)
    .in("movement_type", ["assign_equipment", "unassign_equipment"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Erreur lors de la récupération de l'historique: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...row,
    technician: Array.isArray(row.technician) ? row.technician[0] : row.technician,
  })) as unknown as EquipmentHistoryEntry[];
}

/**
 * Assign equipment to technician via RPC
 */
export async function assignEquipment(
  organizationId: string,
  productId: string,
  technicianId: string,
  quantity: number = 1
) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("assign_equipment", {
    p_organization_id: organizationId,
    p_product_id: productId,
    p_technician_id: technicianId,
    p_quantity: quantity,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Unassign equipment from technician via RPC
 */
export async function unassignEquipment(
  organizationId: string,
  productId: string,
  technicianId: string,
  quantity: number = 1
) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("unassign_equipment", {
    p_organization_id: organizationId,
    p_product_id: productId,
    p_technician_id: technicianId,
    p_quantity: quantity,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Get available equipment for assignment (stock > 0)
 */
export async function getAvailableEquipment(organizationId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, icon_name, icon_color, image_url, stock_current")
    .eq("organization_id", organizationId)
    .eq("product_type", "equipment")
    .is("archived_at", null)
    .gt("stock_current", 0)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erreur: ${error.message}`);
  }

  return data || [];
}

/** Un achat d'outil */
export interface EquipmentPurchase {
  id: string;
  quantity: number;
  unit_price: number | null;
  created_at: string | null;
  supplier: { id: string; name: string } | null;
  invoice_reference: string | null;
  /**
   * Societe qui a paye cet achat.
   *
   * Un meme outil peut etre rachete par l'autre societe : chaque achat porte
   * donc la sienne, exactement comme un consommable. La fiche ne montrait que
   * le fournisseur et le prix, ce qui laissait croire a un outil sans
   * proprietaire.
   */
  organization_id: string | null;
  organization: { id: string; name: string } | null;
}

/**
 * Achats d'un outil.
 *
 * L'historique de la fiche ne montrait que les prets et les retours : on
 * voyait qui detenait l'outil, jamais quand il avait ete achete, a quel prix,
 * ni avec quelle facture.
 */
export async function getEquipmentPurchases(productId: string): Promise<EquipmentPurchase[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      `id, quantity, unit_price, created_at, invoice_reference, organization_id,
       supplier:suppliers(id, name),
       organization:organizations(id, name)`
    )
    .eq("product_id", productId)
    .eq("movement_type", "entry")
    // Les corrections ne sont pas des achats : elles annulent une saisie.
    .is("reverses_movement_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erreur lors de la recuperation des achats: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...row,
    // Supabase renvoie une relation to-one comme un tableau quand la cle
    // etrangere n'est pas unique : on normalise.
    supplier: Array.isArray(row.supplier) ? row.supplier[0] : row.supplier,
    organization: Array.isArray(row.organization) ? row.organization[0] : row.organization,
  })) as unknown as EquipmentPurchase[];
}

/**
 * Corrige la societe portee par un achat d'outil.
 *
 * Reserve a l'outillage. Un consommable ne peut pas etre deplace ainsi : son
 * stock est ventile par societe (`product_organization_stock`), et changer
 * l'etiquette du mouvement sans deplacer les unites ferait diverger les deux.
 * L'outillage, lui, se suit globalement — la societe n'y est qu'une mention
 * d'achat, sans quantite attachee.
 *
 * On ne touche pas au mouvement lui-meme : quantite, prix et date restent ce
 * qu'ils etaient. Seul le nom du payeur change.
 */
export async function updateEquipmentPurchaseOrganization(
  movementId: string,
  organizationId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("stock_movements")
    .update({ organization_id: organizationId })
    .eq("id", movementId);

  if (error) {
    throw new Error(`Erreur lors du changement de société: ${error.message}`);
  }
}
