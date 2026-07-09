"use client";

import Link from "next/link";
import { PlusCircle, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useScanDrawerStore } from "@/lib/stores/scan-drawer-store";

export default function TechniciansHeader() {
  const setOpen = useScanDrawerStore((s) => s.setOpen);

  return (
    <div className="flex items-center justify-between space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">Techniciens</h1>
      <div className="flex gap-2">
        <Button variant="ghost" asChild>
          <Link href="/users/create">
            <PlusCircle /> Ajouter un technicien
          </Link>
        </Button>
        <Button onClick={() => setOpen(true)}>
          <ScanLine /> Restocker
        </Button>
      </div>
    </div>
  );
}
