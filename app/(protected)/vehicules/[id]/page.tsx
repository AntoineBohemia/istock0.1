"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Car,
  FileText,
  Fuel,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Shield,
  Trash2,
  User,
  Wrench,
} from "lucide-react";

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

import { useVehicle } from "@/hooks/queries/use-vehicles";
import { useDeleteVehicle } from "@/hooks/mutations/use-vehicle-mutations";
import EditVehicleDialog from "@/app/(protected)/parametres/vehicules/edit-vehicle-dialog";
import DocumentList from "./document-list";
import { useRouter } from "next/navigation";

const FUEL_LABELS: Record<string, string> = {
  diesel: "Diesel",
  essence: "Essence",
  electrique: "Électrique",
  hybride: "Hybride",
};

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: vehicle, isLoading } = useVehicle(id);
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

  const handleDelete = () => {
    deleteMutation.mutate(vehicle.id, {
      onSuccess: () => {
        toast.success("Véhicule supprimé");
        router.push("/parametres?tab=vehicles");
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

        {/* Metadata grid */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground ml-11">
          {vehicle.brand && (
            <span>
              <Car className="size-3.5 inline mr-1 -mt-0.5" />
              {vehicle.brand}
              {vehicle.model ? ` ${vehicle.model}` : ""}
              {vehicle.year ? ` (${vehicle.year})` : ""}
            </span>
          )}
          {vehicle.fuel_type && (
            <span>
              <Fuel className="size-3.5 inline mr-1 -mt-0.5" />
              {FUEL_LABELS[vehicle.fuel_type] ?? vehicle.fuel_type}
            </span>
          )}
          {vehicle.mileage != null && vehicle.mileage > 0 && (
            <span className="tabular-nums">{vehicle.mileage.toLocaleString("fr-FR")} km</span>
          )}
          {vehicle.vin && <span className="font-mono text-xs">VIN: {vehicle.vin}</span>}
          {vehicle.technician && (
            <Link
              href={`/techniciens/${vehicle.technician.id}`}
              className="inline-flex items-center gap-1.5 hover:underline underline-offset-2"
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
          )}
        </div>

        {vehicle.notes && (
          <p className="text-sm text-muted-foreground ml-11 italic">{vehicle.notes}</p>
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
            <DocumentList
              vehicleId={id}
              organizationId={vehicle.organization_id}
              documentType="photo"
            />
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
