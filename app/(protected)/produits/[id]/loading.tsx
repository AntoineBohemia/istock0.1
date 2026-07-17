import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-[9px]" />
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-24 mt-1.5" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-[9px]" />
          <Skeleton className="h-9 w-20 rounded-[9px]" />
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {/* Stock hero */}
          <Skeleton className="h-28 rounded-xl" />
          {/* Details */}
          <Skeleton className="h-64 rounded-xl" />
          {/* Price history */}
          <Skeleton className="h-40 rounded-xl" />
          {/* Recent movements */}
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="hidden lg:block h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
