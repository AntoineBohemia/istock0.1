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
  product_type: "equipment";
  supplier?: { id: string; name: string } | null;
  assignments: EquipmentAssignment[];
  total_assigned: number;
}

export interface EquipmentFilters {
  organizationId?: string;
  search?: string;
}

/**
 * List all equipment products with their assignments
 */
export async function getEquipmentProducts(
  filters: EquipmentFilters = {}
): Promise<EquipmentProduct[]> {
  const supabase = createClient();
  const { organizationId, search } = filters;

  let query = supabase
    .from("products")
    .select(
      `
      *,
      supplier:suppliers(id, name)
    `
    )
    .eq("product_type", "equipment")
    .is("archived_at", null)
    .order("name", { ascending: true });

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
      supplier:suppliers(id, name)
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
