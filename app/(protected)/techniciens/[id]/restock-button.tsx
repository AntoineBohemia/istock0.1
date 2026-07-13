"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import RestockDialog from "./restock-dialog";

interface TechnicianRestockButtonProps {
  technicianId: string;
}

export default function TechnicianRestockButton({ technicianId }: TechnicianRestockButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Réapprovisionner technicien
      </Button>

      <RestockDialog
        technicianId={technicianId}
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => {}}
      />
    </>
  );
}
