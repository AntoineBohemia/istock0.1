import Image from "next/image";
import Link from "next/link";
import { Package, ImageIcon } from "lucide-react";

interface ProductTotal {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  total_quantity: number;
}

interface TechnicianInventoryProps {
  totals: ProductTotal[];
  year: number;
}

export default function TechnicianInventory({ totals, year }: TechnicianInventoryProps) {
  const grandTotal = totals.reduce((sum, item) => sum + item.total_quantity, 0);

  if (totals.length === 0) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Package className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Aucune sortie en {year}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Aucun produit n&apos;a été sorti vers ce technicien cette année.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {totals.length} produit{totals.length > 1 ? "s" : ""} ·{" "}
        <span className="font-heading font-semibold text-foreground">{grandTotal}</span> unités en{" "}
        {year}
      </p>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="h-11 px-5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Produit
              </th>
              <th className="h-11 px-5 text-center text-xs font-semibold uppercase tracking-wider text-foreground/50">
                Total sorti
              </th>
            </tr>
          </thead>
          <tbody>
            {totals.map((item) => (
              <tr
                key={item.product_id}
                className="border-b last:border-b-0 transition-colors hover:bg-muted/40"
              >
                <td className="px-5 py-4">
                  <Link
                    href={`/product/${item.product_id}`}
                    className="flex items-center gap-3 group/link"
                  >
                    <figure className="flex size-10 items-center justify-center rounded-lg border bg-muted shrink-0 overflow-hidden">
                      {item.product_image_url ? (
                        <Image
                          src={item.product_image_url}
                          width={40}
                          height={40}
                          alt={item.product_name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-5 text-muted-foreground" />
                      )}
                    </figure>
                    <div className="min-w-0">
                      <p className="font-semibold text-[15px] group-hover/link:underline decoration-muted-foreground/40 underline-offset-2">
                        {item.product_name}
                      </p>
                      {item.product_sku && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {item.product_sku}
                        </p>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="font-heading font-bold tabular-nums text-xl">
                    {item.total_quantity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
