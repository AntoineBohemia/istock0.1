import Link from "next/link";
import { Edit3Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EditProductButton({ productId }: { productId: string }) {
  return (
    <Button variant="outline-contrast" asChild>
      <Link href={`/produits/${productId}/modifier`}>
        <Edit3Icon className="size-4" />
        Modifier
      </Link>
    </Button>
  );
}
