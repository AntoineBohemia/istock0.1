import { generateMeta } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit3Icon,
  Mail,
  Phone,
  MapPin,
  Package,
  CalendarClock,
  CalendarPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import TechnicianInventory from "./technician-inventory";
import TechnicianHistory from "./technician-history";
import ArchiveTechnicianButton from "./archive-technician-button";

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

  // Inventory count
  const { data: inventory } = await supabase
    .from("technician_inventory")
    .select("quantity")
    .eq("technician_id", id);

  const inventoryCount =
    inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const productCount = inventory?.length || 0;

  // Last restock
  const { data: lastMovement } = await supabase
    .from("stock_movements")
    .select("created_at")
    .eq("technician_id", id)
    .eq("movement_type", "exit_technician")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Total restocks count
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

function daysSince(dateString: string | null): number | null {
  if (!dateString) return null;
  const diff = Date.now() - new Date(dateString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function restockStatus(days: number | null) {
  if (days === null) return "critique" as const;
  if (days > 21) return "critique" as const;
  if (days > 14) return "attention" as const;
  return "standard" as const;
}

function restockLabel(days: number | null): string {
  if (days === null) return "Jamais restocké";
  if (days === 0) return "Restocké aujourd'hui";
  if (days === 1) return "Restocké hier";
  return `Restocké il y a ${days}j`;
}

function avatarRingClass(
  status: "critique" | "attention" | "standard"
): string {
  switch (status) {
    case "critique":
      return "ring-4 ring-critique/30";
    case "attention":
      return "ring-4 ring-attention/30";
    case "standard":
      return "ring-4 ring-standard/20";
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
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
  const days = daysSince(technician.last_restock_at);
  const status = restockStatus(days);

  // Meta line under the name
  const meta = [
    technician.city,
    technician.phone,
    technician.email,
  ].filter(Boolean);

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="shrink-0 -ml-2"
            >
              <Link href="/users">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <h1 className="font-heading text-2xl font-bold tracking-tight truncate">
              {fullName}
            </h1>
          </div>
          {meta.length > 0 && (
            <p className="text-sm text-muted-foreground pl-10">
              {meta.join(" · ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" asChild>
            <Link href={`/users/${id}/edit`}>
              <Edit3Icon className="size-4" />
              Modifier
            </Link>
          </Button>
          <ArchiveTechnicianButton
            technicianId={id}
            technicianName={fullName}
          />
        </div>
      </div>

      {/* ── Hero: Inventory + Sidebar ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left: Inventory hero */}
        <div className="space-y-5">
          {/* Big inventory number */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Inventaire actuel
                </p>
                <div className="flex items-baseline gap-3">
                  <span className="font-heading text-5xl font-bold tabular-nums leading-none">
                    {technician.inventory_count}
                  </span>
                  <span className="text-muted-foreground text-lg">items</span>
                </div>
              </div>
              <StatusPill
                status={status}
                label={restockLabel(days)}
                className="text-sm px-3 py-1"
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">Produits</p>
              <p className="font-heading text-lg font-semibold tabular-nums">
                {technician.product_count}
              </p>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">
                Total restocks
              </p>
              <p className="font-heading text-lg font-semibold tabular-nums">
                {technician.total_restocks}
              </p>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">
                Dernier restock
              </p>
              <p className="font-heading text-lg font-semibold tabular-nums">
                {days === null ? "—" : days === 0 ? "Auj." : `${days}j`}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Avatar + compact details */}
        <div className="space-y-4">
          {/* Avatar card */}
          <div className="rounded-xl border bg-card p-6 flex flex-col items-center text-center">
            <Avatar
              className={`size-20 text-2xl mb-3 ${avatarRingClass(status)}`}
            >
              <AvatarFallback className="text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="font-heading font-bold text-lg">{fullName}</p>
            {technician.city && (
              <p className="text-sm text-muted-foreground">{technician.city}</p>
            )}
          </div>

          {/* Details compact */}
          <div className="rounded-xl border bg-card divide-y text-sm">
            {technician.email && (
              <div className="flex items-center gap-3 px-4 py-2.5">
                <Mail className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Email</span>
                <span className="ml-auto font-medium truncate max-w-[140px]">
                  {technician.email}
                </span>
              </div>
            )}
            {technician.phone && (
              <div className="flex items-center gap-3 px-4 py-2.5">
                <Phone className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Téléphone</span>
                <span className="ml-auto font-medium tabular-nums">
                  {technician.phone}
                </span>
              </div>
            )}
            {technician.city && (
              <div className="flex items-center gap-3 px-4 py-2.5">
                <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Département</span>
                <span className="ml-auto font-medium">{technician.city}</span>
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-2.5">
              <CalendarClock className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Dernier restock</span>
              <span className="ml-auto font-medium">
                {formatDate(technician.last_restock_at)}
              </span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <CalendarPlus className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Créé le</span>
              <span className="ml-auto font-medium">
                {formatDate(technician.created_at)}
              </span>
            </div>
          </div>
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
