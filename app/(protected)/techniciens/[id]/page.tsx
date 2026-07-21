import { generateMeta } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Car, Mail, Package, Phone, Shirt, Tablet, Wrench } from "lucide-react";

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

  // Toutes les queries sont indépendantes → paralléliser.
  // technician_inventory et le comptage des réappros ont été retirés : leurs
  // résultats (inventory_count, total_restocks) n'étaient rendus nulle part,
  // soit deux allers-retours réseau par ouverture de fiche pour rien.
  const [lastMovementResult, yearMovementsResult, equipmentResult, vehicleResult] =
    await Promise.all([
      supabase
        .from("stock_movements")
        .select("created_at")
        .eq("technician_id", id)
        .eq("movement_type", "exit_technician")
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
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
    yearly_product_totals: yearlyProductTotals,
    year_movements: yearMovements,
    last_restock_at: lastMovementResult.data?.created_at || null,
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
  searchParams: Promise<{ year?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { year: yearParam, tab: tabParam } = await searchParams;
  // L'onglet est pilotable par l'URL : la liste peut ainsi pointer directement
  // sur l'outillage d'un technicien. Valeur inconnue → onglet par defaut.
  const TABS = ["inventory", "history", "equipment"];
  const activeTab = tabParam && TABS.includes(tabParam) ? tabParam : "inventory";
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
      {/* Retour sur sa propre ligne : place entre l'avatar et le nom, il
          entrait en concurrence avec l'identite du technicien. */}
      <BackButton label="Retour aux techniciens" className="-ml-2" />

      {/* ── Fiche d'identite ── */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-5">
          <Avatar className="size-14 shrink-0">
            {technician.photo_url && <AvatarImage src={technician.photo_url} />}
            <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight truncate">{fullName}</h1>

            {/* Identite : ville et organisation. L'ancienne ligne melait tout
                — coordonnees, rattachement et activite — separe par des points
                medians, sans hierarchie lisible. */}
            <p className="text-sm text-muted-foreground mt-0.5">
              {[technician.city, technician.organization_name].filter(Boolean).join(" · ") ||
                "Aucun rattachement"}
            </p>

            {/* Deux niveaux distincts. Avant, coordonnees, vehicule et date de
                reappro etaient sur une seule ligne au meme gris : le seul
                element non cliquable se confondait avec les liens. */}

            {/* 1. Ce sur quoi on agit — en noir, souligne au survol */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-sm">
              {technician.phone && (
                <a
                  href={`tel:${technician.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-1.5 font-medium hover:underline underline-offset-4"
                >
                  <Phone className="size-3.5 text-muted-foreground" />
                  <span className="tabular-nums">{technician.phone}</span>
                </a>
              )}
              {technician.email && (
                <a
                  href={`mailto:${technician.email}`}
                  className="flex items-center gap-1.5 font-medium hover:underline underline-offset-4"
                >
                  <Mail className="size-3.5 text-muted-foreground" />
                  {technician.email}
                </a>
              )}
              {technician.vehicle && (
                <Link
                  href={`/vehicules/${technician.vehicle.id}`}
                  className="flex items-center gap-1.5 font-medium hover:underline underline-offset-4"
                >
                  <Car className="size-3.5 text-muted-foreground" />
                  {/* name vaut déjà « marque modèle » : ne pas le répéter */}
                  <span>{technician.vehicle.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {technician.vehicle.license_plate}
                  </span>
                </Link>
              )}
            </div>

            {/* 2. Ce qu'on constate — en gris, non cliquable.
                Tablette et taille de vetement etaient saisies dans les trois
                formulaires et affichees nulle part : 0 technicien sur 28 les
                renseignait. Personne ne remplit un champ qu'il ne voit jamais. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2 text-[13px] text-muted-foreground">
              {!technician.vehicle && (
                <span className="flex items-center gap-1.5">
                  <Car className="size-3.5" />
                  Aucun véhicule
                </span>
              )}
              {technician.tablet_ref && (
                <span className="flex items-center gap-1.5">
                  <Tablet className="size-3.5" />
                  {technician.tablet_ref}
                </span>
              )}
              {(technician.clothing_size_top || technician.clothing_size_bottom) && (
                <span className="flex items-center gap-1.5">
                  <Shirt className="size-3.5" />
                  {/* Deux systemes de mesure differents : on nomme lequel est
                      lequel, « L / 42 » seul serait ambigu. */}
                  {[
                    technician.clothing_size_top && `Haut ${technician.clothing_size_top}`,
                    technician.clothing_size_bottom && `Bas ${technician.clothing_size_bottom}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                Dernier réappro {formatDate(technician.last_restock_at)}
              </span>
            </div>
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
        <Tabs defaultValue={activeTab} className="flex-1">
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
