import AchatsStats from "./achats-stats";
import AchatsList from "./achats-list";

export const metadata = { title: "Achats" };

export default function AchatsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Achats</h1>
      <AchatsStats />
      <div className="pt-4">
        <AchatsList />
      </div>
    </div>
  );
}
