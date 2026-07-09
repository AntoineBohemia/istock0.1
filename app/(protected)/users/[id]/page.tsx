import { generateMeta } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit3Icon, CalendarClock, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import TechnicianInventory from "./technician-inventory";
import TechnicianHistory from "./technician-history";
import ArchiveTechnicianButton from "./archive-technician-button";
import TechnicianRestockButton from "./restock-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: technician } = await supabase
    .from("technicians")
    .select("first_name, last_name")
    .eq("id", id)
    .single();

  const name = technician
    ? `${technician.first_name} ${technician.last_name}`
    : "Technicien";

  return generateMeta({
    title: name,
    description: `Profil et inventaire du technicien ${name}`,
    canonical: `/users/${id}`,
  });
}

async function getTechnician(id: string) {
  const supabase = await createClient();

  const { data: technician, error } = await supabase
    .from("technicians")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !technician) {
    return null;
  }

  const { data: inventory } = await supabase
    .from("technician_inventory")
    .select("quantity")
    .eq("technician_id", id);

  const inventoryCount =
    inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const productCount = inventory?.length || 0;

  const { data: lastMovement } = await supabase
    .from("stock_movements")
    .select("created_at")
    .eq("technician_id", id)
    .eq("movement_type", "exit_technician")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { count: totalRestocks } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .eq("technician_id", id)
    .eq("movement_type", "exit_technician");

  return {
    ...technician,
    inventory_count: inventoryCount,
    product_count: productCount,
    last_restock_at: lastMovement?.created_at || null,
    total_restocks: totalRestocks || 0,
  };
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "jamais";
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function TechnicianDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const technician = await getTechnician(id);

  if (!technician) {
    notFound();
  }

  const fullName = `${technician.first_name} ${technician.last_name}`;
  const initials = `${technician.first_name.charAt(0)}${technician.last_name.charAt(0)}`.toUpperCase();

  return (
    <div className="space-y-6 pb-20">
      {/* ── Hero zone ── */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        {/* Identity + actions */}
        <div className="flex items-center gap-5">
          <Button variant="ghost" size="icon" asChild className="shrink-0 -ml-2">
            <Link href="/users">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Avatar className="size-14 shrink-0">
            <AvatarFallback className="text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight truncate">
              {fullName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {technician.city && (
                <>
                  Département{" "}
                  <span className="font-semibold text-foreground">
                    {technician.city}
                  </span>
                  {" · "}
                </>
              )}
              dernier réappro{" "}
              <span className="font-semibold text-foreground">
                {formatDate(technician.last_restock_at)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline-contrast" asChild>
              <Link href={`/users/${id}/edit`}>
                <Edit3Icon className="size-4" />
                Modifier
              </Link>
            </Button>
            <TechnicianRestockButton technicianId={id} />
            <ArchiveTechnicianButton
              technicianId={id}
              technicianName={fullName}
            />
          </div>
        </div>

        {/* Stats inline */}
        <div className="flex items-baseline gap-1.5 flex-wrap border-t pt-5">
          <span className="font-heading text-5xl font-bold tabular-nums leading-none">
            {technician.inventory_count}
          </span>
          <span className="text-muted-foreground text-lg">items</span>
          <span className="text-muted-foreground text-lg mx-1.5">·</span>
          <span className="font-heading text-xl font-bold tabular-nums">
            {technician.product_count}
          </span>
          <span className="text-muted-foreground text-lg">produits</span>
          <span className="text-muted-foreground text-lg mx-1.5">·</span>
          <span className="font-heading text-xl font-bold tabular-nums">
            {technician.total_restocks}
          </span>
          <span className="text-muted-foreground text-lg">
            réapprovisionnements
          </span>
        </div>
      </div>

      {/* ── Tabs: Inventaire + Historique ── */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">
            <Package className="size-4 mr-1.5" />
            Inventaire
          </TabsTrigger>
          <TabsTrigger value="history">
            <CalendarClock className="size-4 mr-1.5" />
            Historique
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <TechnicianInventory technicianId={id} />
        </TabsContent>
        <TabsContent value="history">
          <TechnicianHistory technicianId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
