import AchatsStats from "./achats-stats";
import AchatsList from "./achats-list";
import { AchatsYearProvider, AchatsYearSelector } from "./achats-year-context";

export const metadata = { title: "Achats" };

export default function AchatsPage() {
  // L'annee est portee par un contexte : les cartes de synthese et le tableau
  // doivent regarder la meme periode, sinon les totaux du haut ne correspondent
  // plus aux lignes du bas.
  return (
    <AchatsYearProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Achats</h1>
          <AchatsYearSelector />
        </div>
        <AchatsStats />
        <div className="pt-4">
          <AchatsList />
        </div>
      </div>
    </AchatsYearProvider>
  );
}
