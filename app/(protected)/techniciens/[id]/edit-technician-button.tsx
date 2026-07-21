"use client";

import { useState } from "react";
import { Edit3Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import EditTechnicianModal from "@/components/edit-technician-modal";

interface TechnicianData {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  organization_id: string | null;
  tablet_ref: string | null;
  clothing_size_top: string | null;
  clothing_size_bottom: string | null;
}

export default function EditTechnicianButton({ technician }: { technician: TechnicianData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline-contrast" onClick={() => setOpen(true)}>
        <Edit3Icon className="size-4" />
        Modifier
      </Button>
      <EditTechnicianModal technician={technician} open={open} onOpenChange={setOpen} />
    </>
  );
}
