import { generateMeta } from "@/lib/utils";

import VehicleList from "./vehicle-list";

export async function generateMetadata() {
  return generateMeta({
    title: "Véhicules",
    description: "Gestion de la flotte : véhicules, détenteurs et documents.",
    canonical: "/vehicules",
  });
}

export default function Page() {
  return <VehicleList />;
}
