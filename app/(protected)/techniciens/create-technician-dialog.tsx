"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  createTechnician,
  updateTechnician,
  uploadTechnicianPhoto,
} from "@/lib/supabase/queries/technicians";
import { setTechnicianVehicle } from "@/lib/supabase/queries/vehicles";
import TechnicianPhotoInput from "./technician-photo-input";
import TechnicianVehicleSelect from "./technician-vehicle-select";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useOrganizations } from "@/hooks/queries";
import { CLOTHING_SIZES_TOP, CLOTHING_SIZES_BOTTOM } from "@/lib/constants/clothing-sizes";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

const FormSchema = z.object({
  first_name: z.string().min(2, "Min. 2 caractères"),
  last_name: z.string().min(2, "Min. 2 caractères"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  city: z.string().optional(),
  organization_id: z.string().optional(),
  tablet_ref: z.string().optional(),
  clothing_size_top: z.string().optional(),
  clothing_size_bottom: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface CreateTechnicianDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateTechnicianDialog({
  open,
  onOpenChange,
}: CreateTechnicianDialogProps) {
  const router = useRouter();
  const { currentOrganization } = useOrganizationStore();
  const { data: userOrgs } = useOrganizations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    mode: "onTouched",
    resolver: zodResolver(FormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      city: "",
      organization_id: currentOrganization?.id || "",
      tablet_ref: "",
      clothing_size_top: "",
      clothing_size_bottom: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    if (!currentOrganization) {
      toast.error("Aucune organisation sélectionnée");
      return;
    }

    setIsSubmitting(true);
    try {
      const technician = await createTechnician({
        ...data,
        organization_id: data.organization_id || currentOrganization.id,
      });

      // La photo part apres la creation : uploadTechnicianPhoto a besoin de
      // l'identifiant. Un echec ici ne doit pas perdre le technicien deja cree.
      if (photoFile) {
        try {
          const photoUrl = await uploadTechnicianPhoto(photoFile, technician.id);
          await updateTechnician(technician.id, { photo_url: photoUrl });
        } catch {
          toast.error("Technicien créé, mais la photo n'a pas pu être envoyée");
        }
      }

      // Le vehicule aussi ne peut etre affecte qu'apres coup : la relation
      // vit sur vehicles.technician_id.
      if (vehicleId) {
        try {
          await setTechnicianVehicle(technician.id, vehicleId, null);
          queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
        } catch {
          toast.error("Technicien créé, mais le véhicule n'a pas pu être affecté");
        }
      }

      toast.success(`${data.first_name} ${data.last_name} ajouté`);
      onOpenChange(false);
      form.reset();
      setPhotoFile(null);
      setVehicleId("");
      router.push(`/techniciens/${technician.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Ajouter un technicien</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="px-5 py-4 space-y-3">
              <TechnicianPhotoInput
                file={photoFile}
                onFileChange={setPhotoFile}
                disabled={isSubmitting}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Prénom *"
                          className="bg-white dark:bg-card"
                          {...field}
                        />
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
                      <FormControl>
                        <Input placeholder="Nom *" className="bg-white dark:bg-card" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="Téléphone"
                        className="bg-white dark:bg-card"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Email"
                        className="bg-white dark:bg-card"
                        {...field}
                      />
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
                    <FormControl>
                      <Input
                        placeholder="Département"
                        className="bg-white dark:bg-card"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(userOrgs?.length ?? 0) > 1 && (
                <FormField
                  control={form.control}
                  name="organization_id"
                  render={({ field }) => (
                    <FormItem>
                      {/* Intitule visible, contrairement aux autres champs qui
                          se contentent d'un texte d'invite : celui-ci est
                          pre-rempli avec la societe courante, donc l'invite
                          « Organisation » n'apparait jamais. On lisait « SMPR »
                          sans savoir de quoi il s'agissait — et c'est pourtant
                          la societe a laquelle le technicien sera rattache
                          definitivement. */}
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Société de rattachement
                      </label>
                      <FormControl>
                        <select
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
                        >
                          <option value="" disabled>
                            Choisir une société
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
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="tablet_ref"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Réf. tablette"
                          className="bg-white dark:bg-card"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clothing_size_top"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <select
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
                        >
                          <option value="">Taille haut</option>
                          {CLOTHING_SIZES_TOP.map((s) => (
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
                <FormField
                  control={form.control}
                  name="clothing_size_bottom"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <select
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
                        >
                          <option value="">Taille bas</option>
                          {CLOTHING_SIZES_BOTTOM.map((s) => (
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
              {/* On affecte un vehicule existant au lieu d'en saisir les
                  caracteristiques : la table vehicles est la source de verite. */}
              <TechnicianVehicleSelect
                value={vehicleId}
                onChange={setVehicleId}
                disabled={isSubmitting}
              />
            </div>

            <div className="px-5 pt-2 pb-5">
              <Button type="submit" disabled={isSubmitting} className="w-full h-10 rounded-lg">
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Créer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
