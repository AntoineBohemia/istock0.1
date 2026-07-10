"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StockMovement, MOVEMENT_TYPE_LABELS } from "@/lib/supabase/queries/stock-movements";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useStockMovements } from "@/hooks/queries";
import { exportToCSV } from "@/lib/utils/csv-export";
import CreateMovementDialog from "./create-movement-dialog";

export default function MovementsHeader() {
  const [open, setOpen] = useState(false);
  const { currentOrganization } = useOrganizationStore();

  const { data: movementsResult } = useStockMovements({
    organizationId: currentOrganization?.id,
  });

  const handleExportCSV = () => {
    const movements = movementsResult?.movements || [];
    exportToCSV(movements, "mouvements", [
      {
        header: "Date",
        accessor: (m: StockMovement) =>
          new Date(m.created_at ?? Date.now()).toLocaleDateString("fr-FR"),
      },
      { header: "Type", accessor: (m: StockMovement) => MOVEMENT_TYPE_LABELS[m.movement_type] },
      { header: "Produit", accessor: (m: StockMovement) => m.product?.name },
      { header: "Quantité", accessor: (m: StockMovement) => m.quantity },
      {
        header: "Technicien",
        accessor: (m: StockMovement) =>
          m.technician ? `${m.technician.first_name} ${m.technician.last_name}` : "",
      },
      { header: "Notes", accessor: (m: StockMovement) => m.notes },
    ]);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Mouvements de stock</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-4" />
            Exporter CSV
          </Button>
          <Button variant="outline-contrast" onClick={() => setOpen(true)}>
            <Plus /> Nouveau mouvement
          </Button>
        </div>
      </div>
      <CreateMovementDialog open={open} onOpenChange={setOpen} onSuccess={() => {}} />
    </>
  );
}
