import { Skeleton } from "@/components/ui/skeleton";

export default function TechnicianDetailLoading() {
  return (
    <div className="space-y-6 pb-20">
      {/* Hero zone */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="flex items-center gap-5">
          <Skeleton className="size-9 rounded-[9px]" />
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-[9px]" />
            <Skeleton className="h-9 w-28 rounded-[9px]" />
            <Skeleton className="h-9 w-20 rounded-[9px]" />
          </div>
        </div>
      </div>

      {/* Tabs + year selector */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-80 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-[9px]" />
      </div>

      {/* Tab content */}
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
