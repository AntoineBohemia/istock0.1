"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "../store";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  Package,
  RefreshCw,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tutorials = [
  {
    id: "entry",
    icon: ArrowDownToLine,
    title: "Entree de stock",
    description: "Quand vous recevez une livraison de votre fournisseur",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    example: "Ex: Reception de 50 pots de peinture blanche",
  },
  {
    id: "exit_technician",
    icon: ArrowUpFromLine,
    title: "Sortie vers technicien",
    description: "Quand vous donnez du stock a un technicien pour ses interventions",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    example: "Ex: Jean Dupont prend 5 pots pour ses chantiers",
  },
  {
    id: "exit_anonymous",
    icon: Package,
    title: "Sortie anonyme",
    description: "Vente directe ou sortie sans attribution a un technicien",
    color: "text-gray-600",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
    example: "Ex: Vente comptoir a un client de passage",
  },
  {
    id: "restock",
    icon: RefreshCw,
    title: "Restock technicien",
    description: "Reinitialiser l'inventaire d'un technicien (ex: retour de vacances)",
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    example: "Ex: Jean revient avec 2 pots, on met a jour son stock",
  },
];

export function StockTutorialStep() {
  const { nextStep, prevStep, markStepCompleted } = useOnboardingStore();
  const [viewedTutorials, setViewedTutorials] = useState<string[]>([]);

  const handleViewTutorial = (id: string) => {
    if (!viewedTutorials.includes(id)) {
      setViewedTutorials((prev) => [...prev, id]);
    }
  };

  const handleContinue = () => {
    markStepCompleted("stock-tutorial");
    nextStep();
  };

  const allViewed = viewedTutorials.length === tutorials.length;

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <div className="bg-primary flex size-10 items-center justify-center rounded-full">
          <BookOpen className="text-primary-foreground size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Comprendre les mouvements de stock</h1>
          <p className="text-muted-foreground">
            Decouvrez les 4 types de mouvements pour gerer votre inventaire
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {tutorials.map((tutorial) => {
          const isViewed = viewedTutorials.includes(tutorial.id);
          return (
            <div
              key={tutorial.id}
              onClick={() => handleViewTutorial(tutorial.id)}
              className={cn(
                "relative cursor-pointer rounded-lg border p-5 transition-all hover:border-primary",
                isViewed && "border-primary bg-primary/5"
              )}
            >
              {isViewed && (
                <div className="absolute right-3 top-3">
                  <div className="bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="size-3" />
                  </div>
                </div>
              )}

              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "rounded-lg p-3",
                    tutorial.bgColor
                  )}
                >
                  <tutorial.icon className={cn("size-6", tutorial.color)} />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="font-semibold">{tutorial.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {tutorial.description}
                  </p>
                  <p className="text-xs text-muted-foreground italic mt-2">
                    {tutorial.example}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "size-8 rounded-full flex items-center justify-center text-sm font-medium",
                allViewed
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted-foreground/20 text-muted-foreground"
              )}
            >
              {viewedTutorials.length}/{tutorials.length}
            </div>
            <span className="text-sm text-muted-foreground">
              {allViewed
                ? "Vous avez decouvert tous les types de mouvements"
                : "Cliquez sur chaque carte pour la decouvrir"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Retour
        </Button>
        <Button size="lg" onClick={handleContinue}>
          {allViewed ? "Terminer la configuration" : "Continuer quand meme"}
        </Button>
      </div>
    </div>
  );
}
