"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function TechniciansHeader() {
  return (
    <div className="flex items-center justify-between space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">Techniciens</h1>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/users/create">
            <PlusCircle /> Ajouter un technicien
          </Link>
        </Button>
      </div>
    </div>
  );
}
