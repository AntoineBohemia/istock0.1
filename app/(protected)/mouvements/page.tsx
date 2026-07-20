import { generateMeta } from "@/lib/utils";
import MovementsList from "./movements-list";

export async function generateMetadata() {
  return generateMeta({
    title: "Mouvements de stock",
    description: "Historique des entrées et sorties de stock. Gérez les flux d'inventaire.",
    canonical: "/mouvements",
  });
}

export default function Page() {
  // Le titre et l'export sont rendus par MovementsList : l'export doit
  // connaitre les filtres courants, qui vivent dans ce composant.
  return <MovementsList />;
}
