"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface YearSelectorProps {
  currentYear: number;
  selectedYear: number;
  minYear: number;
  technicianId: string;
}

export default function YearSelector({
  currentYear,
  selectedYear,
  minYear,
  technicianId,
}: YearSelectorProps) {
  const router = useRouter();
  const effectiveMin = Math.min(minYear, currentYear - 2);

  const canGoBack = selectedYear > effectiveMin;
  const canGoForward = selectedYear < currentYear;

  const navigate = (y: number) => {
    if (y === currentYear) {
      router.push(`/users/${technicianId}`);
    } else {
      router.push(`/users/${technicianId}?year=${y}`);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={!canGoBack}
        onClick={() => navigate(selectedYear - 1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="font-heading text-lg font-bold tabular-nums min-w-[4ch] text-center">
        {selectedYear}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={!canGoForward}
        onClick={() => navigate(selectedYear + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
