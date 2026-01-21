"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useOnboardingStore } from "../store";
import { Building2, Loader2 } from "lucide-react";
import { createOrganization } from "@/lib/supabase/queries/organizations";
import { toast } from "sonner";

const sectors = [
  { value: "peinture", label: "Peinture", emoji: "🎨", desc: "Peintures et finitions" },
  { value: "revetement", label: "Revetement", emoji: "🏠", desc: "Sols et murs" },
  { value: "batiment", label: "Batiment", emoji: "🏗️", desc: "Materiaux construction" },
  { value: "automobile", label: "Automobile", emoji: "🚗", desc: "Peintures vehicules" },
  { value: "industrie", label: "Industrie", emoji: "🏭", desc: "Applications industrielles" },
  { value: "autre", label: "Autre", emoji: "📦", desc: "Autre secteur" },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

export function OrganizationStep() {
  const {
    data,
    updateOrganization,
    setCreatedOrganizationId,
    nextStep,
    prevStep,
    markStepCompleted,
    isLoading,
    setLoading,
  } = useOnboardingStore();

  const [localName, setLocalName] = useState(data.organization.name);

  const toggleSector = (value: string) => {
    const current = data.organization.sectors;
    if (current.includes(value)) {
      updateOrganization({ sectors: current.filter((s) => s !== value) });
    } else {
      updateOrganization({ sectors: [...current, value] });
    }
  };

  const handleCreate = async () => {
    if (!localName.trim() || data.organization.sectors.length === 0) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);

    try {
      const slug = generateSlug(localName.trim());
      const org = await createOrganization(localName.trim(), slug);

      updateOrganization({ name: localName.trim() });
      setCreatedOrganizationId(org.id);
      markStepCompleted("organization");
      toast.success("Organisation creee avec succes !");
      nextStep();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur lors de la creation";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const isValid = localName.trim().length >= 2 && data.organization.sectors.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <div className="bg-primary flex size-10 items-center justify-center rounded-full">
          <Building2 className="text-primary-foreground size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Creez votre organisation</h1>
          <p className="text-muted-foreground">
            Votre espace de travail pour gerer votre stock
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="org-name">Nom de l'organisation</Label>
          <Input
            id="org-name"
            placeholder="Ex: Peintures Dupont, Mon Entreprise..."
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            className="text-base"
          />
          <p className="text-xs text-muted-foreground">
            Ce nom sera visible par tous les membres de votre equipe
          </p>
        </div>

        <div className="space-y-4">
          <Label>Secteurs d'activite <span className="text-muted-foreground font-normal">(plusieurs choix possibles)</span></Label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {sectors.map((sector) => {
              const isSelected = data.organization.sectors.includes(sector.value);
              return (
                <div
                  key={sector.value}
                  onClick={() => toggleSector(sector.value)}
                  className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border p-4 text-center transition-colors hover:border-primary ${
                    isSelected ? "bg-primary/10 border-primary" : ""
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    className="absolute top-2 right-2"
                    onCheckedChange={() => toggleSector(sector.value)}
                  />
                  <span className="text-2xl mb-1">{sector.emoji}</span>
                  <span className="font-medium text-sm">{sector.label}</span>
                  <span className="text-xs text-muted-foreground">{sector.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Retour
        </Button>
        <Button size="lg" onClick={handleCreate} disabled={!isValid || isLoading}>
          {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Creer l'organisation
        </Button>
      </div>
    </div>
  );
}
