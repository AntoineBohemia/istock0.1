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
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-medium font-heading",
        // Tailwind needs to see these classes literally to generate them
        status === "critique" && "text-critique bg-critique-bg",
        status === "attention" && "text-attention bg-attention-bg",
        status === "standard" && "text-muted-foreground",
        className
      )}
    >
      {status === "standard" && <span className="size-1.5 rounded-full shrink-0 bg-standard" />}
      {label ??
        (status === "critique" ? "Critique" : status === "attention" ? "Attention" : "Standard")}
    </span>
  );
}
