"use client";

import { createContext, useContext, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Annee consultee sur la page Achats.
 *
 * Les cartes de synthese et le tableau doivent regarder la meme annee : un
 * contexte plutot que deux etats separes, sinon les totaux du haut et les
 * lignes du bas peuvent diverger.
 */
const AchatsYearContext = createContext<{
  year: number;
  setYear: (y: number) => void;
  currentYear: number;
} | null>(null);

export function AchatsYearProvider({ children }: { children: React.ReactNode }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  return (
    <AchatsYearContext.Provider value={{ year, setYear, currentYear }}>
      {children}
    </AchatsYearContext.Provider>
  );
}

export function useAchatsYear() {
  const ctx = useContext(AchatsYearContext);
  if (!ctx) throw new Error("useAchatsYear doit être utilisé dans AchatsYearProvider");
  return ctx;
}

export function AchatsYearSelector() {
  const { year, setYear, currentYear } = useAchatsYear();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        // Les achats ne remontent pas au-dela de 5 ans : au-dela, la page
        // n'afficherait que des zeros.
        disabled={year <= currentYear - 5}
        onClick={() => setYear(year - 1)}
        aria-label="Année précédente"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="font-heading text-lg font-bold tabular-nums min-w-[4ch] text-center">
        {year}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={year >= currentYear}
        onClick={() => setYear(year + 1)}
        aria-label="Année suivante"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
