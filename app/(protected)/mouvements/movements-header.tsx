"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import StockEntryModal from "@/components/stock-entry-modal";
import StockExitModal from "@/components/stock-exit-modal";

export default function MovementsHeader() {
  const [entryOpen, setEntryOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Mouvements de stock</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="bg-white dark:bg-card"
            onClick={() => setExitOpen(true)}
          >
            <ArrowUpFromLine className="size-4" />
            Sortie de stock
          </Button>
          <Button onClick={() => setEntryOpen(true)}>
            <ArrowDownToLine className="size-4" />
            Entrer en stock
          </Button>
        </div>
      </div>

      <StockEntryModal open={entryOpen} onClose={() => setEntryOpen(false)} />
      <StockExitModal open={exitOpen} onClose={() => setExitOpen(false)} />
    </>
  );
}
