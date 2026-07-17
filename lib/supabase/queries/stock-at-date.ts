import { createClient } from "@/lib/supabase/client";

export interface StockAtDateRow {
  product_id: string;
  product_name: string;
  product_sku: string;
  category_name: string | null;
  supplier_name: string | null;
  stock_at_date: number;
  stock_current: number;
  stock_min: number;
  price_at_date: number | null;
}

export async function getStockAtDate(
  organizationId: string,
  targetDate: string,
  filterOrgId?: string | null
): Promise<StockAtDateRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_stock_at_date", {
    p_organization_id: organizationId,
    p_target_date: targetDate,
    p_filter_org_id: filterOrgId || undefined,
  });

  if (error) {
    throw new Error(`Erreur lors du calcul du stock à date: ${error.message}`);
  }

  return (data as StockAtDateRow[]) ?? [];
}
