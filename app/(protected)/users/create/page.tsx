import { generateMeta } from "@/lib/utils";
import TechnicianForm from "./technician-form";

export async function generateMetadata() {
  return generateMeta({
    title: "Ajouter un technicien",
    description: "Créer un nouveau technicien",
    canonical: "/users/create",
  });
}

export default function CreateTechnicianPage() {
  return <TechnicianForm mode="create" />;
}
