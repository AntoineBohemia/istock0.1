import Link from "next/link";
import { generateMeta } from "@/lib/utils";
import { PlusCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <>
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Techniciens</h1>
        <Button asChild>
          <Link href="/users/create">
            <PlusCircleIcon /> Ajouter un technicien
          </Link>
        </Button>
      </div>
      <TechniciansList />
    </>
  );
}
