import { generateMeta } from "@/lib/utils";

import TechniciansHeader from "./technicians-header";
import TechnicianStats from "./technicians-stats";
import TechniciansList from "./technicians-list";

export async function generateMetadata() {
  return generateMeta({
    title: "Techniciens",
    description: "Liste des techniciens et gestion de leur inventaire.",
    canonical: "/users",
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <TechniciansHeader />
      <TechnicianStats />
      <div className="pt-4">
        <TechniciansList />
      </div>
    </div>
  );
}
