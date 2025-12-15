import { generateMeta } from "@/lib/utils";
import MovementsOverview from "./movements-overview";
import MovementsList from "./movements-list";

export async function generateMetadata() {
  return generateMeta({
    title: "Mouvements de stock",
    description:
      "Historique des entrées et sorties de stock. Gérez les flux d'inventaire.",
    canonical: "/orders",
  });
}

export default function Page() {
  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            Mouvements de stock
          </h1>
          <p className="text-muted-foreground">
            Historique des entrées et sorties de stock
          </p>
        </div>
      </div>
      <MovementsOverview />
      <MovementsList />
    </div>
  );
}
