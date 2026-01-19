"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboardingStore } from "../store";
import { Users, Loader2, Info, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function FirstTechnicianStep() {
  const {
    data,
    updateTechnician,
    setCreatedTechnicianId,
    nextStep,
    prevStep,
    skipStep,
    markStepCompleted,
    isLoading,
    setLoading,
  } = useOnboardingStore();

  const [localTechnician, setLocalTechnician] = useState({
    firstName: data.technician.firstName || "",
    lastName: data.technician.lastName || "",
    email: data.technician.email || "",
    city: data.technician.city || "",
  });

  const handleChange = (field: string, value: string) => {
    setLocalTechnician((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    if (!localTechnician.firstName.trim() || !localTechnician.lastName.trim()) {
      toast.error("Veuillez entrer le nom du technicien");
      return;
    }

    if (!data.createdOrganizationId) {
      toast.error("Organisation non trouvee");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data: technician, error } = await supabase
        .from("technicians")
        .insert({
          organization_id: data.createdOrganizationId,
          first_name: localTechnician.firstName.trim(),
          last_name: localTechnician.lastName.trim(),
          email: localTechnician.email.trim() || null,
          city: localTechnician.city.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      updateTechnician(localTechnician);
      setCreatedTechnicianId(technician.id);
      markStepCompleted("first-technician");
      toast.success("Technicien ajoute avec succes !");
      nextStep();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur lors de la creation";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    skipStep();
    toast.info("Vous pourrez ajouter des techniciens plus tard");
  };

  const isValid =
    localTechnician.firstName.trim().length >= 2 &&
    localTechnician.lastName.trim().length >= 2;

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <div className="bg-primary flex size-10 items-center justify-center rounded-full">
          <Users className="text-primary-foreground size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Ajoutez un technicien</h1>
          <p className="text-muted-foreground">
            Les techniciens recoivent du stock et interviennent sur le terrain
          </p>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex gap-3">
          <Truck className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Comment ca fonctionne ?</p>
            <ul className="text-muted-foreground mt-2 space-y-1">
              <li>1. Vous enregistrez vos techniciens dans l'application</li>
              <li>2. Vous leur attribuez du stock (sortie vers technicien)</li>
              <li>3. Chaque technicien a son propre inventaire a suivre</li>
              <li>4. Vous pouvez les restocker a tout moment</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first-name">Prenom *</Label>
          <Input
            id="first-name"
            placeholder="Ex: Jean"
            value={localTechnician.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="last-name">Nom *</Label>
          <Input
            id="last-name"
            placeholder="Ex: Dupont"
            value={localTechnician.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="jean.dupont@exemple.com"
            value={localTechnician.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">Ville / Zone</Label>
          <Input
            id="city"
            placeholder="Ex: Paris, Zone Nord..."
            value={localTechnician.city}
            onChange={(e) => handleChange("city", e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Retour
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleSkip}>
            Passer cette etape
          </Button>
          <Button size="lg" onClick={handleCreate} disabled={!isValid || isLoading}>
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Ajouter le technicien
          </Button>
        </div>
      </div>
    </div>
  );
}
