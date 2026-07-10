import { cn } from "@/lib/utils";

export type StockStatus = "critique" | "attention" | "standard";

interface StatusPillProps {
  status: StockStatus;
  label?: string;
  className?: string;
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-medium",
        // Tailwind needs to see these classes literally to generate them
        status === "critique" && "text-critique bg-critique-bg",
        status === "attention" && "text-attention bg-attention-bg",
        status === "standard" && "text-standard bg-standard-bg",
        className
      )}
    >
      {label ??
        (status === "critique" ? "Critique" : status === "attention" ? "Attention" : "Bon")}
    </span>
  );
}
