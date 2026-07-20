"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import CreateTechnicianDialog from "./create-technician-dialog";

export default function TechniciansHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Techniciens</h1>
        {/* Meme style que « Ajouter un fournisseur » : un seul geste, un seul look */}
        <Button variant="outline" className="bg-white dark:bg-card" onClick={() => setOpen(true)}>
          <Plus className="mr-2 size-4" /> Ajouter un technicien
        </Button>
      </div>

      <CreateTechnicianDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
