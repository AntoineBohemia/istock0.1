import { createClient } from "@/lib/supabase/client";

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  organization_id: string | null;
  created_at: string | null;
}

export interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
}

/**
 * Récupère toutes les catégories
 */
export async function getCategories(organizationId?: string): Promise<Category[]> {
  const supabase = createClient();

  let query = supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des catégories: ${error.message}`);
  }

  return data || [];
}

/**
 * Récupère les catégories organisées en arborescence
 */
export async function getCategoriesTree(organizationId?: string): Promise<CategoryWithChildren[]> {
  const categories = await getCategories(organizationId);

  const categoryMap = new Map<string, CategoryWithChildren>();
  const rootCategories: CategoryWithChildren[] = [];

  // Créer une map de toutes les catégories
  categories.forEach((cat) => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });

  // Organiser en arborescence
  categories.forEach((cat) => {
    const category = categoryMap.get(cat.id)!;
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      categoryMap.get(cat.parent_id)!.children!.push(category);
    } else {
      rootCategories.push(category);
    }
  });

  return rootCategories;
}

/**
 * Récupère uniquement les catégories parentes (sans parent_id)
 */
export async function getParentCategories(organizationId?: string): Promise<Category[]> {
  const supabase = createClient();

  let query = supabase
    .from("categories")
    .select("*")
    .is("parent_id", null)
    .order("name", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des catégories parentes: ${error.message}`);
  }

  return data || [];
}

/**
 * Récupère les sous-catégories d'une catégorie parente
 */
export async function getSubCategories(parentId: string): Promise<Category[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("parent_id", parentId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération des sous-catégories: ${error.message}`);
  }

  return data || [];
}

/**
 * Crée une nouvelle catégorie
 */
export async function createCategory(
  organizationId: string,
  name: string,
  parentId?: string | null
): Promise<Category> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      organization_id: organizationId,
      name,
      parent_id: parentId || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur lors de la création de la catégorie: ${error.message}`);
  }

  return data;
}

/**
 * Met à jour une catégorie existante
 */
export async function updateCategory(
  id: string,
  name: string,
  parentId?: string | null
): Promise<Category> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("categories")
    .update({
      name,
      parent_id: parentId === undefined ? undefined : parentId,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur lors de la mise à jour de la catégorie: ${error.message}`);
  }

  return data;
}

/**
 * Supprime une catégorie
 */
export async function deleteCategory(id: string): Promise<void> {
  const supabase = createClient();

  // Vérifier s'il y a des sous-catégories
  const { data: children } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_id", id);

  if (children && children.length > 0) {
    throw new Error("Impossible de supprimer une catégorie qui contient des sous-catégories");
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la suppression de la catégorie: ${error.message}`);
  }
}

/**
 * Récupère une catégorie par son ID
 */
export async function getCategoryById(id: string): Promise<Category | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Erreur lors de la récupération de la catégorie: ${error.message}`);
  }

  return data;
}
