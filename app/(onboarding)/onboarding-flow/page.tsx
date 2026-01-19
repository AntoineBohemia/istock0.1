import Onboarding from "./components/onboarding";
import { generateMeta } from "@/lib/utils";

export async function generateMetadata() {
  return generateMeta({
    title: "Configuration de votre espace",
    description:
      "Configurez votre espace iStock en quelques etapes simples. Creez votre organisation, ajoutez vos produits et techniciens.",
    canonical: "/onboarding-flow",
  });
}

export default function Page() {
  return <Onboarding />;
}
