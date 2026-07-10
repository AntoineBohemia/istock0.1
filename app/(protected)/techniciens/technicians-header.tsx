import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function TechniciansHeader() {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">Techniciens</h1>
      <Button variant="outline-contrast" asChild>
        <Link href="/techniciens/create">
          <Plus /> Ajouter un technicien
        </Link>
      </Button>
    </div>
  );
}
