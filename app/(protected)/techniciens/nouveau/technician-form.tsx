"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createTechnician,
  updateTechnician,
  uploadTechnicianPhoto,
} from "@/lib/supabase/queries/technicians";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useOrganizations } from "@/hooks/queries";

const FormSchema = z.object({
  first_name: z.string().min(2, {
    message: "Le prénom doit contenir au moins 2 caractères.",
  }),
  last_name: z.string().min(2, {
    message: "Le nom doit contenir au moins 2 caractères.",
  }),
  email: z
    .string()
    .email({ message: "Veuillez entrer une adresse email valide." })
    .optional()
    .or(z.literal("")),
  phone: z.string().optional(),
  city: z.string().optional(),
  organization_id: z.string().optional(),
  tablet_ref: z.string().optional(),
  clothing_size: z.string().optional(),
  vehicle_plate: z.string().optional(),
  vehicle_brand: z.string().optional(),
  vehicle_model: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface TechnicianFormProps {
  mode?: "create" | "edit";
  initialData?: FormValues & { id?: string; photo_url?: string | null };
}

export default function TechnicianForm({ mode = "create", initialData }: TechnicianFormProps) {
  const router = useRouter();
  const { currentOrganization } = useOrganizationStore();
  const { data: userOrgs } = useOrganizations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.photo_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    mode: "onTouched",
    resolver: zodResolver(FormSchema),
    defaultValues: {
      first_name: initialData?.first_name || "",
      last_name: initialData?.last_name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      city: initialData?.city || "",
      organization_id: initialData?.organization_id || currentOrganization?.id || "",
      tablet_ref: initialData?.tablet_ref || "",
      clothing_size: initialData?.clothing_size || "",
      vehicle_plate: initialData?.vehicle_plate || "",
      vehicle_brand: initialData?.vehicle_brand || "",
      vehicle_model: initialData?.vehicle_model || "",
    },
  });

  async function onSubmit(data: FormValues) {
    if (!currentOrganization) {
      toast.error("Aucune organisation sélectionnée");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload photo if a new file was selected
      let photoUrl = initialData?.photo_url || null;
      if (photoFile) {
        const tempId = initialData?.id || crypto.randomUUID();
        photoUrl = await uploadTechnicianPhoto(photoFile, tempId);
      }

      if (mode === "edit" && initialData?.id) {
        await updateTechnician(
          initialData.id,
          { ...data, photo_url: photoUrl },
          currentOrganization.id
        );
        toast.success("Technicien mis à jour avec succès");
        router.push(`/techniciens/${initialData.id}`);
      } else {
        const technician = await createTechnician({
          ...data,
          photo_url: photoUrl,
          organization_id: data.organization_id || currentOrganization.id,
        });
        toast.success("Technicien créé avec succès");
        router.push(`/techniciens/${technician.id}`);
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : mode === "edit"
            ? "Erreur lors de la mise à jour"
            : "Erreur lors de la création"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleCancel = () => {
    if (mode === "edit" && initialData?.id) {
      router.push(`/techniciens/${initialData.id}`);
    } else {
      router.push("/techniciens");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline-contrast"
              size="icon"
              type="button"
              onClick={() => router.back()}
            >
              <ChevronLeft />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "edit" ? "Modifier le technicien" : "Ajouter un technicien"}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "edit" ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative size-16 rounded-full border-2 border-dashed border-border hover:border-foreground/30 transition-colors overflow-hidden shrink-0 group"
                >
                  {photoPreview ? (
                    <Image src={photoPreview} alt="Photo" fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center size-full bg-muted">
                      <Camera className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPhotoFile(file);
                        setPhotoPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </button>
                <div>
                  <CardTitle>Informations personnelles</CardTitle>
                  <CardDescription>Nom, prénom et coordonnées du technicien</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom *</FormLabel>
                      <FormControl>
                        <Input placeholder="Jean" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom *</FormLabel>
                      <FormControl>
                        <Input placeholder="Dupont" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="jean.dupont@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact et localisation</CardTitle>
              <CardDescription>Informations optionnelles de contact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(userOrgs?.length ?? 0) > 1 && (
                <FormField
                  control={form.control}
                  name="organization_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organisation</FormLabel>
                      <FormControl>
                        <select
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="border-input bg-background text-sm flex h-9 w-full rounded-md border px-3 py-1.5 outline-none focus:border-ring focus:ring-ring/50 focus:ring-[3px]"
                        >
                          <option value="" disabled>
                            Sélectionner
                          </option>
                          {userOrgs?.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="06 12 34 56 78" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville</FormLabel>
                    <FormControl>
                      <Input placeholder="Paris" {...field} />
                    </FormControl>
                    <FormDescription>Ville d&apos;affectation du technicien</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tablet_ref"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Réf. tablette</FormLabel>
                      <FormControl>
                        <Input placeholder="Samsung Tab A8" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clothing_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taille vêtement</FormLabel>
                      <FormControl>
                        <select
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="border-input bg-background text-sm flex h-9 w-full rounded-md border px-3 py-1.5 outline-none focus:border-ring focus:ring-ring/50 focus:ring-[3px]"
                        >
                          <option value="">—</option>
                          {["XS", "S", "M", "L", "XL", "XXL", "3XL"].map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="vehicle_plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plaque véhicule</FormLabel>
                      <FormControl>
                        <Input placeholder="AB-123-CD" className="font-mono uppercase" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vehicle_brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marque</FormLabel>
                      <FormControl>
                        <Input placeholder="Renault" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vehicle_model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modèle</FormLabel>
                      <FormControl>
                        <Input placeholder="Kangoo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}
