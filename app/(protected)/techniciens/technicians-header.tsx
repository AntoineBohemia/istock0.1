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
        <Button variant="outline-contrast" onClick={() => setOpen(true)}>
          <Plus /> Ajouter un technicien
        </Button>
      </div>

      <CreateTechnicianDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
