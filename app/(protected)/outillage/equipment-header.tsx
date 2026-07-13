"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import CreateEquipmentDialog from "./create-equipment-dialog";

export default function EquipmentHeader() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">Outillage</h1>
      <Button variant="outline-contrast" onClick={() => setOpen(true)}>
        <Plus /> Ajouter un outil
      </Button>
      <CreateEquipmentDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
