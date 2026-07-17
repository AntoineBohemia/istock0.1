"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  wrapperClassName,
}: SearchInputProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("pl-9", value && "pr-8", className)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Effacer la recherche"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
