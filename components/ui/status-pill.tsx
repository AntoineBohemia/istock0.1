import { cn } from "@/lib/utils";

export type StockStatus = "critique" | "attention" | "standard";

interface StatusPillProps {
  status: StockStatus;
  label?: string;
  className?: string;
}

const statusConfig: Record<StockStatus, { wrapper: string; dot?: string; defaultLabel: string }> = {
  critique: {
    wrapper: "text-critique bg-critique-bg",
    defaultLabel: "Critique",
  },
  attention: {
    wrapper: "text-attention bg-attention-bg",
    defaultLabel: "Attention",
  },
  standard: {
    wrapper: "text-muted-foreground",
    dot: "bg-standard",
    defaultLabel: "Standard",
  },
};

export function StatusPill({ status, label, className }: StatusPillProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-medium font-heading",
        config.wrapper,
        className
      )}
    >
      {config.dot && <span className={cn("size-1.5 rounded-full shrink-0", config.dot)} />}
      {label ?? config.defaultLabel}
    </span>
  );
}
