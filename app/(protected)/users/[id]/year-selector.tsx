"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const years: number[] = [];
  for (let y = currentYear; y >= minYear; y--) {
    years.push(y);
  }

  return (
    <Select
      value={String(selectedYear)}
      onValueChange={(value) => {
        const y = parseInt(value, 10);
        if (y === currentYear) {
          router.push(`/users/${technicianId}`);
        } else {
          router.push(`/users/${technicianId}?year=${y}`);
        }
      }}
    >
      <SelectTrigger className="w-auto h-auto gap-1 border-none bg-transparent p-0 font-heading text-lg font-bold tabular-nums shadow-none focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
