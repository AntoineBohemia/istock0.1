import { generateMeta } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Car, Package, Wrench } from "lucide-react";

import { BackButton } from "@/components/back-button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import TechnicianInventory from "./technician-inventory";
import TechnicianHistory from "./technician-history";
import TechnicianEquipment from "./technician-equipment";
import ArchiveTechnicianButton from "./archive-technician-button";
import EditTechnicianButton from "./edit-technician-button";
import TechnicianRestockButton from "./restock-button";
import YearSelector from "./year-selector";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: technician } = await supabase
    .from("technicians")
    .select("first_name, last_name")
    .eq("id", id)
    .single();

  const name = technician ? `${technician.first_name} ${technician.last_name}` : "Technicien";

  return generateMeta({
    title: name,
    description: `Profil et inventaire du technicien ${name}`,
    canonical: `/techniciens/${id}`,
  });
}

async function getTechnician(id: string, year: number) {
  const supabase = await createClient();

  const { data: technician, error } = await supabase
    .from("technicians")
    .select("*, organization:organizations(name)")
    .eq("id", id)
    .single();

  if (error || !technician) {
    return null;
  }

  const yearStart = new Date(year, 0, 1).toISOString();
  const yearEnd = new Date(year + 1, 0, 1).toISOString();

  // Toutes les queries sont indépendantes → paralléliser
  const [
    inventoryResult,
    lastMovementResult,
    restocksResult,
    yearMovementsResult,
    equipmentResult,
    vehicleResult,
  ] = await Promise.all([
    supabase.from("technician_inventory").select("quantity").eq("technician_id", id),
    supabase
      .from("stock_movements")
      .select("created_at")
      .eq("technician_id", id)
      .eq("movement_type", "exit_technician")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("technician_inventory_history")
      .select("id", { count: "exact", head: true })
      .eq("technician_id", id)
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd),
    supabase
      .from("stock_movements")
      .select("id, product_id, quantity, created_at, product:products(id, name, sku, image_url)")
      .eq("technician_id", id)
      .eq("movement_type", "exit_technician")
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd)
      .order("created_at", { ascending: false }),
    supabase.from("equipment_assignments").select("quantity").eq("technician_id", id),
    // Véhicule assigné (table vehicles — source de vérité)
    supabase
      .from("vehicles")
      .select("id, name, license_plate")
      .eq("technician_id", id)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle(),
  ]);

  const inventoryCount = inventoryResult.data?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const equipmentCount = equipmentResult.data?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  // Agréger les sorties par produit côté serveur
  const productMap = new Map<
    string,
    {
      product_id: string;
      product_name: string;
      product_sku: string | null;
      product_image_url: string | null;
      total_quantity: number;
    }
  >();
  for (const item of yearMovementsResult.data || []) {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    const pid = item.product_id;
    const existing = productMap.get(pid);
    if (existing) {
      existing.total_quantity += item.quantity;
    } else {
      productMap.set(pid, {
        product_id: pid,
        product_name: product?.name || "Produit supprimé",
        product_sku: product?.sku || null,
        product_image_url: product?.image_url || null,
        total_quantity: item.quantity,
      });
    }
  }
  const yearlyProductTotals = Array.from(productMap.values()).sort(
    (a, b) => b.total_quantity - a.total_quantity
  );
  const yearUnitsTotal = yearlyProductTotals.reduce((sum, p) => sum + p.total_quantity, 0);

  // Mouvements de l'année pour l'historique (déjà fetchés, on normalise)
  const yearMovements = (yearMovementsResult.data || []).map((item) => ({
    id: item.id,
    product_id: item.product_id,
    quantity: item.quantity,
    created_at: item.created_at,
    product: Array.isArray(item.product) ? item.product[0] : item.product,
  }));

  const orgData = technician.organization as { name: string } | { name: string }[] | null;
  const organizationName = Array.isArray(orgData) ? orgData[0]?.name : orgData?.name;

  return {
    ...technician,
    organization_name: organizationName ?? null,
    vehicle: vehicleResult.data ?? null,
    inventory_count: inventoryCount,
    year_units_total: yearUnitsTotal,
    yearly_product_totals: yearlyProductTotals,
    year_movements: yearMovements,
    last_restock_at: lastMovementResult.data?.created_at || null,
    total_restocks: restocksResult.count || 0,
    equipment_count: equipmentCount,
    created_year: new Date(technician.created_at!).getFullYear(),
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = yearParam ? parseInt(yearParam, 10) : currentYear;
  const year = Number.isNaN(selectedYear) ? currentYear : selectedYear;

  const technician = await getTechnician(id, year);

  if (!technician) {
    notFound();
  }

  const fullName = `${technician.first_name} ${technician.last_name}`;
  const initials =
    `${technician.first_name.charAt(0)}${technician.last_name.charAt(0)}`.toUpperCase();

  return (
    <div className="space-y-6 pb-20">
      {/* ── Hero zone ── */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        {/* Identity + actions */}
        <div className="flex items-center gap-5">
          <BackButton label="Retour aux techniciens" className="shrink-0 -ml-2" />
          <Avatar className="size-14 shrink-0">
            {technician.photo_url && <AvatarImage src={technician.photo_url} />}
            <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight truncate">{fullName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {technician.city && (
                <>
                  Département{" "}
                  <span className="font-semibold text-foreground">{technician.city}</span>
                  {" · "}
                </>
              )}
              {technician.phone && (
                <>
                  <span className="tabular-nums">{technician.phone}</span>
                  {" · "}
                </>
              )}
              {technician.organization_name && (
                <>
                  <span className="font-semibold text-foreground">
                    {technician.organization_name}
                  </span>
                  {" · "}
                </>
              )}
              dernier réappro{" "}
              <span className="font-semibold text-foreground">
                {formatDate(technician.last_restock_at)}
              </span>
            </p>
            {/* Véhicule assigné — depuis la table vehicles */}
            <p className="text-sm text-muted-foreground mt-1">
              <Car className="inline size-3.5 mr-1 -mt-0.5" />
              {technician.vehicle ? (
                <Link
                  href={`/vehicules/${technician.vehicle.id}`}
                  className="hover:underline underline-offset-2"
                >
                  {/* name vaut déjà « marque modèle » : ne pas le répéter */}
                  <span className="font-semibold text-foreground">{technician.vehicle.name}</span>
                  {" · "}
                  <span className="font-mono">{technician.vehicle.license_plate}</span>
                </Link>
              ) : (
                <span>Aucun véhicule assigné</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <EditTechnicianButton technician={technician} />
            <TechnicianRestockButton technicianId={id} />
            <ArchiveTechnicianButton technicianId={id} technicianName={fullName} />
          </div>
        </div>
      </div>

      {/* ── Year selector + Tabs ── */}
      <div className="flex items-center justify-between">
        <Tabs defaultValue="inventory" className="flex-1">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="inventory">
                <Package className="size-4 mr-1.5" />
                Total annuel
              </TabsTrigger>
              <TabsTrigger value="history">
                <CalendarClock className="size-4 mr-1.5" />
                Historique
              </TabsTrigger>
              <TabsTrigger value="equipment">
                <Wrench className="size-4 mr-1.5" />
                Outillage
                {technician.equipment_count > 0 && (
                  <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-foreground/[0.07] text-[10px] font-bold tabular-nums leading-none">
                    {technician.equipment_count}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <YearSelector
              currentYear={currentYear}
              selectedYear={year}
              minYear={technician.created_year}
              technicianId={id}
            />
          </div>
          <div className="mt-4">
            <TabsContent value="inventory">
              <TechnicianInventory
                totals={technician.yearly_product_totals}
                year={year}
                technicianId={id}
                technicianName={`${technician.first_name} ${technician.last_name.charAt(0)}.`}
              />
            </TabsContent>
            <TabsContent value="history">
              <TechnicianHistory movements={technician.year_movements} year={year} />
            </TabsContent>
            <TabsContent value="equipment">
              <TechnicianEquipment
                technicianId={id}
                technicianName={`${technician.first_name} ${technician.last_name.charAt(0)}.`}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
