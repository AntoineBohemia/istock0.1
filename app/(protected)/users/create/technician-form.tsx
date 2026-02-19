"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createTechnician,
  updateTechnician,
} from "@/lib/supabase/queries/technicians";
import { useOrganizationStore } from "@/lib/stores/organization-store";

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
});

type FormValues = z.infer<typeof FormSchema>;

interface TechnicianFormProps {
  mode?: "create" | "edit";
  initialData?: FormValues & { id?: string };
}

export default function TechnicianForm({
  mode = "create",
  initialData,
}: TechnicianFormProps) {
  const router = useRouter();
  const { currentOrganization } = useOrganizationStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      first_name: initialData?.first_name || "",
      last_name: initialData?.last_name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      city: initialData?.city || "",
    },
  });

  async function onSubmit(data: FormValues) {
    if (!currentOrganization) {
      toast.error("Aucune organisation sélectionnée");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "edit" && initialData?.id) {
        await updateTechnician(initialData.id, data);
        toast.success("Technicien mis à jour avec succès");
        router.push(`/users/${initialData.id}`);
      } else {
        const technician = await createTechnician({
          ...data,
          organization_id: currentOrganization.id,
        });
        toast.success("Technicien créé avec succès");
        router.push(`/users/${technician.id}`);
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
      router.push(`/users/${initialData.id}`);
    } else {
      router.push("/users");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" type="button" asChild>
              <Link href={mode === "edit" && initialData?.id ? `/users/${initialData.id}` : "/users"}>
                <ChevronLeft />
              </Link>
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
              <CardTitle>Informations personnelles</CardTitle>
              <CardDescription>
                Nom, prénom et coordonnées du technicien
              </CardDescription>
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
                      <Input
                        type="email"
                        placeholder="jean.dupont@example.com"
                        {...field}
                      />
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
              <CardDescription>
                Informations optionnelles de contact
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="06 12 34 56 78"
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
                    <FormLabel>Ville</FormLabel>
                    <FormControl>
                      <Input placeholder="Paris" {...field} />
                    </FormControl>
                    <FormDescription>
                      Ville d&apos;affectation du technicien
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}
