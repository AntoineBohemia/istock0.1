import { generateMeta } from "@/lib/utils";
import MovementsHeader from "./movements-header";
import MovementsList from "./movements-list";

export async function generateMetadata() {
  return generateMeta({
    title: "Mouvements de stock",
    description: "Historique des entrées et sorties de stock. Gérez les flux d'inventaire.",
    canonical: "/orders",
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <MovementsHeader />
      <div className="pt-4">
        <MovementsList />
      </div>
    </div>
  );
}
