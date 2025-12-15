import { generateMeta } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit3Icon,
  Package,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import TechnicianInventory from "./technician-inventory";
import TechnicianHistory from "./technician-history";
import DeleteTechnicianButton from "./delete-technician-button";

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

  // Récupérer le nombre d'items en inventaire
  const { data: inventory } = await supabase
    .from("technician_inventory")
    .select("quantity")
    .eq("technician_id", id);

  const inventoryCount = inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  // Récupérer le dernier restock
  const { data: lastHistory } = await supabase
    .from("technician_inventory_history")
    .select("created_at")
    .eq("technician_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return {
    ...technician,
    inventory_count: inventoryCount,
    last_restock_at: lastHistory?.created_at || null,
  };
}

function generateInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/users">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Avatar className="size-16">
            <AvatarFallback className="text-xl">
              {generateInitials(technician.first_name, technician.last_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {technician.first_name} {technician.last_name}
            </h1>
            <p className="text-muted-foreground">{technician.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/users/${id}/edit`}>
              <Edit3Icon className="size-4" />
              Modifier
            </Link>
          </Button>
          <DeleteTechnicianButton
            technicianId={id}
            technicianName={`${technician.first_name} ${technician.last_name}`}
          />
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{technician.email}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Phone className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Téléphone</p>
              <p className="font-medium">{technician.phone || "-"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-primary/10 p-3">
              <MapPin className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ville</p>
              <p className="font-medium">{technician.city || "-"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Package className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inventaire</p>
              <div className="flex items-center gap-2">
                <p className="font-medium">{technician.inventory_count} items</p>
                {technician.inventory_count === 0 && (
                  <Badge variant="warning">Vide</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Inventory and History */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventaire actuel</TabsTrigger>
          <TabsTrigger value="history">Historique des restocks</TabsTrigger>
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
