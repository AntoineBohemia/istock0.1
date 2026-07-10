"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import CreateMovementDialog from "./create-movement-dialog";

export default function MovementsHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Mouvements de stock</h1>
        <Button variant="outline-contrast" onClick={() => setOpen(true)}>
          <Plus /> Nouveau mouvement
        </Button>
      </div>
      <CreateMovementDialog open={open} onOpenChange={setOpen} onSuccess={() => {}} />
    </>
  );
}
