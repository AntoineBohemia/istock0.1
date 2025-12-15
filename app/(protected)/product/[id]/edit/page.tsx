import { generateMeta } from "@/lib/utils";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddProductForm from "../../create/add-product-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", id)
    .single();

  return generateMeta({
    title: product?.name ? `Modifier - ${product.name}` : "Modifier le produit",
    description: "Modifier les informations du produit",
    canonical: `/product/${id}/edit`,
  });
}

async function getProduct(id: string) {
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("id", id)
    .single();

  if (error || !product) {
    return null;
  }

  return product;
}

// Get parent category ID from a category (could be itself if it's a parent, or parent_id if it's a sub-category)
async function getParentCategoryId(categoryId: string | null) {
  if (!categoryId) return null;

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, parent_id")
    .eq("id", categoryId)
    .single();

  if (!category) return null;

  // If category has a parent, it's a sub-category
  return category.parent_id || category.id;
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  // Determine if the product's category is a sub-category or parent category
  const parentCategoryId = await getParentCategoryId(product.category_id);
  const isSubCategory = parentCategoryId && parentCategoryId !== product.category_id;

  const initialData = {
    id: product.id,
    name: product.name,
    sku: product.sku || "",
    description: product.description || "",
    price: product.price?.toString() || "",
    stock_current: product.stock_current?.toString() || "0",
    stock_min: product.stock_min?.toString() || "10",
    stock_max: product.stock_max?.toString() || "100",
    category_id: isSubCategory ? parentCategoryId : (product.category_id || ""),
    sub_category_id: isSubCategory ? product.category_id || "" : "",
    supplier_name: product.supplier_name || "",
    is_perishable: product.is_perishable || false,
    track_stock: product.track_stock ?? true,
    image_url: product.image_url || undefined,
  };

  return <AddProductForm mode="edit" initialData={initialData} />;
}
