import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 p-2">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
