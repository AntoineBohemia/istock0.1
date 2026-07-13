import { generateMeta } from "@/lib/utils";

import EquipmentHeader from "./equipment-header";
import EquipmentList from "./equipment-list";

export async function generateMetadata() {
  return generateMeta({
    title: "Outillage",
    description:
      "Gestion de l'outillage et des équipements. Suivez l'assignation des outils aux techniciens.",
    canonical: "/outillage",
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <EquipmentHeader />
      <EquipmentList />
    </div>
  );
}
