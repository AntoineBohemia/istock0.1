"use client";

import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "../store";
import { Package, Users, TrendingUp, Sparkles, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Package,
    title: "Gestion de stock",
    description: "Suivez vos produits en temps reel avec alertes de stock bas",
  },
  {
    icon: Users,
    title: "Suivi techniciens",
    description: "Gerez l'inventaire de chaque technicien sur le terrain",
  },
  {
    icon: TrendingUp,
    title: "Analyses",
    description: "Visualisez l'evolution de votre stock et optimisez vos commandes",
  },
];

export function WelcomeStep() {
  const { nextStep, markStepCompleted } = useOnboardingStore();

  const handleStart = () => {
    markStepCompleted("welcome");
    nextStep();
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center">
          <Sparkles className="size-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">Bienvenue sur iStock</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          La solution complete pour gerer votre stock de peintures et revetements.
          Configurons votre espace en quelques etapes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-lg border bg-card p-6 text-center space-y-3"
          >
            <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center">
              <feature.icon className="size-6 text-primary" />
            </div>
            <h3 className="font-semibold">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-muted/50 rounded-lg p-6 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
            5 min
          </span>
          Ce que nous allons configurer ensemble
        </h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="bg-primary/20 text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium">
              1
            </span>
            Creer votre organisation
          </li>
          <li className="flex items-center gap-2">
            <span className="bg-primary/20 text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium">
              2
            </span>
            Ajouter votre premier produit
          </li>
          <li className="flex items-center gap-2">
            <span className="bg-primary/20 text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium">
              3
            </span>
            Enregistrer un technicien
          </li>
          <li className="flex items-center gap-2">
            <span className="bg-primary/20 text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium">
              4
            </span>
            Comprendre les mouvements de stock
          </li>
        </ol>
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={handleStart} className="gap-2">
          Commencer la configuration
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
