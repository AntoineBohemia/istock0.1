import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MovementRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: movement, error } = await supabase
    .from("stock_movements")
    .select("movement_type")
    .eq("id", id)
    .single();

  if (error || !movement) {
    notFound();
  }

  if (movement.movement_type === "entry") {
    redirect(`/orders/income/${id}`);
  } else {
    redirect(`/orders/outcome/${id}`);
  }
}
