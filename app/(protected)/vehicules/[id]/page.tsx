"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Car,
  ClipboardCheck,
  FileText,
  Fuel,
  Gauge,
  Hash,
  History,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Shield,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/lib/toast";

import { useVehicle, useVehicleAssignments } from "@/hooks/queries/use-vehicles";
import VehicleAssignmentHistory from "@/components/vehicle-assignment-history";
import { useDeleteVehicle } from "@/hooks/mutations/use-vehicle-mutations";
import EditVehicleDialog from "../edit-vehicle-dialog";
import DocumentList from "./document-list";
import PhotoGallery from "./photo-gallery";
import InspectionList from "./inspection-list";
import { useRouter } from "next/navigation";

const FUEL_LABELS: Record<string, string> = {
  diesel: "Diesel",
  essence: "Essence",
  electrique: "Électrique",
  hybride: "Hybride",
};

/** « depuis 3 mois » — la duree de detention en cours, en clair. */
function formatHeldFor(assignedAt: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(assignedAt).getTime()) / 86_400_000));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "1 jour";
  if (days < 31) return `${days} jours`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  return `${years} an${years > 1 ? "s" : ""}`;
}

/** Une caracteristique : son intitule au-dessus, sa valeur en dessous. */
function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium">{children}</dd>
    </div>
  );
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: vehicle, isLoading } = useVehicle(id);
  const { data: assignments = [], isLoading: isHistoryLoading } = useVehicleAssignments(id);
  const deleteMutation = useDeleteVehicle();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-10 w-72 rounded-md" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!vehicle) return notFound();

  // Detention en cours : c'est elle qui donne le « depuis quand ».
  const currentHolding = assignments.find((a) => a.released_at === null);

  const handleDelete = () => {
    deleteMutation.mutate(vehicle.id, {
      onSuccess: () => {
        toast.success("Véhicule supprimé");
        router.push("/vehicules");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Erreur");
      },
    });
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Hero */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <PageHeader
          title={vehicle.name}
          subtitle={
            <p className="text-sm text-muted-foreground mt-0.5 font-mono tracking-wide">
              {vehicle.license_plate}
            </p>
          }
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4 mr-1.5" />
                Modifier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4 mr-1.5" />
                Supprimer
              </Button>
            </>
          }
        />

        {/* Caracteristiques.
            C'etait une phrase de valeurs grises separees par des espaces, sans
            intitules et decalee d'un `ml-11` cale sur la fleche de retour : on
            lisait « 128 000 km » sans savoir si c'etait le kilometrage ou autre
            chose, et « Diesel » collait a la marque. Chaque donnee porte
            desormais son nom, et les valeurs ressortent. */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-3 lg:grid-cols-4">
          {vehicle.brand && (
            <Field icon={Car} label="Modèle">
              {vehicle.brand}
              {vehicle.model ? ` ${vehicle.model}` : ""}
              {vehicle.year ? ` (${vehicle.year})` : ""}
            </Field>
          )}
          {vehicle.fuel_type && (
            <Field icon={Fuel} label="Carburant">
              {FUEL_LABELS[vehicle.fuel_type] ?? vehicle.fuel_type}
            </Field>
          )}
          {vehicle.mileage != null && vehicle.mileage > 0 && (
            <Field icon={Gauge} label="Kilométrage">
              <span className="tabular-nums">{vehicle.mileage.toLocaleString("fr-FR")} km</span>
            </Field>
          )}
          {vehicle.vin && (
            <Field icon={Hash} label="VIN">
              <span className="font-mono text-sm">{vehicle.vin}</span>
            </Field>
          )}
          {vehicle.technician && (
            <Field icon={User} label="Technicien">
              <Link
                href={`/techniciens/${vehicle.technician.id}`}
                className="inline-flex items-center gap-2 hover:underline underline-offset-2"
              >
                <Avatar className="size-5">
                  {vehicle.technician.photo_url && (
                    <AvatarImage
                      src={vehicle.technician.photo_url}
                      alt={`${vehicle.technician.first_name} ${vehicle.technician.last_name}`}
                    />
                  )}
                  <AvatarFallback className="text-[8px] font-bold uppercase">
                    {vehicle.technician.first_name.charAt(0)}
                    {vehicle.technician.last_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {vehicle.technician.first_name} {vehicle.technician.last_name}
              </Link>
              {currentHolding && (
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  depuis {formatHeldFor(currentHolding.assigned_at)}
                </span>
              )}
            </Field>
          )}
        </dl>

        {/* Les notes sortent de l'italique : c'est du texte a lire, pas une
            citation. */}
        {vehicle.notes && (
          <div className="border-t pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes
            </p>
            <p className="mt-1.5 text-sm whitespace-pre-wrap">{vehicle.notes}</p>
          </div>
        )}
      </div>

      {/* Tabs: Contrats / Factures entretien / Assurance */}
      <Tabs defaultValue="contract">
        <TabsList>
          <TabsTrigger value="contract">
            <FileText className="size-4 mr-1.5" />
            Contrats
          </TabsTrigger>
          <TabsTrigger value="revision">
            <Wrench className="size-4 mr-1.5" />
            Factures entretien
          </TabsTrigger>
          <TabsTrigger value="insurance">
            <Shield className="size-4 mr-1.5" />
            Assurance
          </TabsTrigger>
          <TabsTrigger value="photo">
            <ImageIcon className="size-4 mr-1.5" />
            Photos
          </TabsTrigger>
          <TabsTrigger value="holders">
            <History className="size-4 mr-1.5" />
            Détenteurs
          </TabsTrigger>
          <TabsTrigger value="inspections">
            <ClipboardCheck className="size-4 mr-1.5" />
            États des lieux
          </TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="contract">
            <DocumentList
              vehicleId={id}
              organizationId={vehicle.organization_id}
              documentType="contract"
            />
          </TabsContent>
          <TabsContent value="revision">
            <DocumentList
              vehicleId={id}
              organizationId={vehicle.organization_id}
              documentType="revision"
            />
          </TabsContent>
          <TabsContent value="insurance">
            <DocumentList
              vehicleId={id}
              organizationId={vehicle.organization_id}
              documentType="insurance"
            />
          </TabsContent>
          <TabsContent value="photo">
            {/* Galerie et non liste de fichiers : une photo se regarde. */}
            <PhotoGallery vehicleId={id} organizationId={vehicle.organization_id} />
          </TabsContent>
          <TabsContent value="holders">
            <VehicleAssignmentHistory
              assignments={assignments}
              isLoading={isHistoryLoading}
              subject="technician"
            />
          </TabsContent>
          <TabsContent value="inspections">
            <InspectionList vehicleId={id} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Edit dialog */}
      {editOpen && <EditVehicleDialog open onOpenChange={setEditOpen} vehicle={vehicle} />}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce véhicule</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {vehicle.name} ({vehicle.license_plate}) ? Tous les
              documents associés seront également supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
