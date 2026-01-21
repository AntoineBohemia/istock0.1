"use client";

import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "../store";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Package,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const stockMovements = [
  {
    id: "entry",
    icon: ArrowDownToLine,
    title: "Entree de stock",
    description: "Quand vous recevez une livraison de votre fournisseur",
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    borderColor: "border-green-200 dark:border-green-800",
    example: "Ex: Reception de 50 pots de peinture blanche",
  },
  {
    id: "exit_technician",
    icon: ArrowUpFromLine,
    title: "Sortie vers technicien",
    description: "Quand vous donnez du stock a un technicien pour ses interventions",
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    example: "Ex: Jean Dupont prend 5 pots pour ses chantiers",
  },
  {
    id: "exit_anonymous",
    icon: Package,
    title: "Sortie anonyme",
    description: "Vente directe ou sortie sans attribution a un technicien",
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    borderColor: "border-orange-200 dark:border-orange-800",
    example: "Ex: Vente comptoir a un client de passage",
  },
  {
    id: "restock",
    icon: RefreshCw,
    title: "Restock technicien",
    description: "Reinitialiser l'inventaire d'un technicien (ex: retour de vacances)",
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    borderColor: "border-purple-200 dark:border-purple-800",
    example: "Ex: Jean revient avec 2 pots, on met a jour son stock",
  },
];

export function StockTutorialStep() {
  const { nextStep, prevStep, markStepCompleted } = useOnboardingStore();

  const handleContinue = () => {
    markStepCompleted("stock-tutorial");
    nextStep();
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <div className="bg-primary flex size-10 items-center justify-center rounded-full">
          <BookOpen className="text-primary-foreground size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Les mouvements de stock</h1>
          <p className="text-muted-foreground">
            Voici les 4 types de mouvements pour gerer votre inventaire
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {stockMovements.map((movement) => (
          <div
            key={movement.id}
            className={cn(
              "rounded-lg border p-5",
              movement.borderColor
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "rounded-lg p-3",
                  movement.bgColor
                )}
              >
                <movement.icon className={cn("size-6", movement.color)} />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="font-semibold">{movement.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {movement.description}
                </p>
                <p className="text-xs text-muted-foreground italic mt-2">
                  {movement.example}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Retour
        </Button>
        <Button size="lg" onClick={handleContinue}>
          Continuer
        </Button>
      </div>
    </div>
  );
}
