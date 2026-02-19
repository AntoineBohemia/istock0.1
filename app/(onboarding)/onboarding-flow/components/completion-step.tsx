"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "../store";
import {
  CheckCircle2,
  ArrowRight,
  Package,
  Users,
  Building2,
  Sparkles,
  FolderTree,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function CompletionStep() {
  const router = useRouter();
  const { data, completedSteps, reset } = useOnboardingStore();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Confetti animation
    const loadConfetti = async () => {
      try {
        const confetti = (await import("canvas-confetti")).default;
        const duration = 2000;
        const end = Date.now() + duration;

        const frame = () => {
          confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.8 },
            colors: ["#3b82f6", "#10b981", "#8b5cf6"],
          });
          confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.8 },
            colors: ["#3b82f6", "#10b981", "#8b5cf6"],
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };

        frame();
      } catch {
        // Confetti not available, ignore
      }
    };

    loadConfetti();
    saveProgress();
  }, []);

  const saveProgress = async () => {
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();

      if (userData.user) {
        await supabase.from("onboarding_progress").upsert({
          user_id: userData.user.id,
          organization_id: data.createdOrganizationId || null,
          current_step: "completed",
          completed_steps: completedSteps,
          onboarding_data: data as unknown as import("@/lib/supabase/database.types").Json,
          completed_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error saving onboarding progress:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoToDashboard = () => {
    reset();
    router.push("/global");
  };

  const handleGoToProducts = () => {
    reset();
    router.push("/product");
  };

  const handleGoToTechnicians = () => {
    reset();
    router.push("/users");
  };

  const categoriesCount = data.createdCategoryIds.length;
  const productsCount = data.createdProductIds.length;

  const summary = [
    {
      icon: Building2,
      label: "Organisation",
      value: data.organization.name || "Non creee",
      created: !!data.createdOrganizationId,
    },
    {
      icon: FolderTree,
      label: "Categories",
      value: categoriesCount > 0
        ? `${categoriesCount} categorie${categoriesCount > 1 ? "s" : ""} creee${categoriesCount > 1 ? "s" : ""}`
        : "Aucune categorie",
      created: categoriesCount > 0,
    },
    {
      icon: Package,
      label: "Produits",
      value: productsCount > 0
        ? `${productsCount} produit${productsCount > 1 ? "s" : ""} cree${productsCount > 1 ? "s" : ""}`
        : "Aucun produit",
      created: productsCount > 0,
    },
    {
      icon: Users,
      label: "Technicien",
      value: data.technician.firstName
        ? `${data.technician.firstName} ${data.technician.lastName}`
        : "Non ajoute",
      created: !!data.createdTechnicianId,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="mx-auto bg-green-100 dark:bg-green-900/30 w-20 h-20 rounded-full flex items-center justify-center">
          <CheckCircle2 className="size-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold">Configuration terminee !</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Votre espace iStock est pret. Vous pouvez maintenant commencer a gerer
          votre stock efficacement.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          Resume de votre configuration
        </h3>
        <div className="space-y-3">
          {summary.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-3 rounded-lg bg-background"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    item.created
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-muted"
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-4",
                      item.created ? "text-green-600" : "text-muted-foreground"
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="font-medium">{item.value}</p>
                </div>
              </div>
              {item.created && (
                <CheckCircle2 className="size-5 text-green-600" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground text-center">
          Que souhaitez-vous faire maintenant ?
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={handleGoToDashboard}
          >
            <Sparkles className="size-5" />
            <span>Voir le dashboard</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={handleGoToProducts}
          >
            <Package className="size-5" />
            <span>Ajouter des produits</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={handleGoToTechnicians}
          >
            <Users className="size-5" />
            <span>Gerer les techniciens</span>
          </Button>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button size="lg" onClick={handleGoToDashboard} className="gap-2">
          Acceder au dashboard
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
