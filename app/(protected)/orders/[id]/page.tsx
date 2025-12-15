import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  EditIcon,
  Package,
  Pencil,
  Printer,
  Truck,
} from "lucide-react";
import { generateMeta } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

type OrderStatus = "processing" | "shipped" | "out-for-delivery" | "delivered";

interface Order {
  id: string;
  date: string;
  status: OrderStatus;
  customer: {
    name: string;
    email: string;
    address: string;
  };
  items: {
    id: number;
    name: string;
    image: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  shipping: number;
  total: number;
}

export async function generateMetadata() {
  return generateMeta({
    title: "Détail du flux",
    description:
      "Consultez et suivez les détails de vos commandes de peinture. Interface construite avec shadcn/ui, Tailwind CSS et Next.js.",
    canonical: "/dashboard/commandes/detail",
  });
}

export default function Page() {
  const order: Order = {
    id: "CMD-12345",
    date: "2025-04-15",
    status: "shipped",
    customer: {
      name: "SEIREN",
      email: "contact@seiren.fr",
      address: "40 rue Newton, 77240 Cesson, France",
    },
    items: [
      {
        id: 1,
        name: "Peinture acrylique blanche 10 L",
        image: "/produits/01.jpeg",
        quantity: 4,
        price: 79.99,
      },
      {
        id: 2,
        name: "Rouleau anti‑goutte 180 mm",
        image: "/produits/02.jpeg",
        quantity: 2,
        price: 7.5,
      },
    ],
    subtotal: 334.96,
    shipping: 12.0,
    total: 346.96,
  };

  const statusSteps: Record<OrderStatus, string> = {
    processing: "En préparation",
    shipped: "Expédiée",
    "out-for-delivery": "En cours de livraison",
    delivered: "Livrée",
  };

  const currentStep = statusSteps[order.status];
  const currentStepIndex = Object.keys(statusSteps).indexOf(order.status);

  return (
    <div className="mx-auto max-w-screen-lg space-y-4 lg:mt-10">
      <div className="flex items-center justify-between">
        <Button asChild variant="outline">
          <Link href="/orders">
            <ChevronLeft />
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer />
            Imprimer
          </Button>
          <Button>
            <Pencil />
            Modifier
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Entrée</CardTitle>
            <p className="text-muted-foreground text-sm">
              Passée le {order.date}
            </p>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Informations client</h3>
                <p>{order.customer.name}</p>
                <p>{order.customer.email}</p>
                <p className="text-muted-foreground text-sm">
                  {order.customer.address}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Résumé de l'entrée {order.id}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>Sous‑total</span>
              <span>€{order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Livraison</span>
              <span>€{order.shipping.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>€{order.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            Statut de livraison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-6 pt-1">
            <div className="mb-2 flex items-center justify-between">
              {Object.keys(statusSteps).map((step, index) => (
                <div key={index} className="text-center">
                  <div
                    className={`mx-auto flex size-12 items-center justify-center rounded-full text-lg ${
                      index <= currentStepIndex
                        ? "bg-green-600 text-white dark:bg-green-900"
                        : "bg-muted border"
                    } `}
                  >
                    {index < currentStepIndex ? (
                      <CheckCircle className="size-5" />
                    ) : (
                      {
                        processing: <Package className="size-5" />,
                        shipped: <Truck className="size-5" />,
                        "out-for-delivery": <Truck className="size-5" />,
                        delivered: <CheckCircle2 className="size-5" />,
                      }[step as OrderStatus]
                    )}
                  </div>
                  <div className="mt-2 text-xs">
                    {statusSteps[step as OrderStatus]}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-6">
              <Progress
                className="w-full"
                value={
                  (currentStepIndex / (Object.keys(statusSteps).length - 1)) *
                  100
                }
                color="bg-green-200 dark:bg-green-800"
              />
              <div className="text-muted-foreground text-sm">
                <Badge variant="secondary" className="me-1">
                  {currentStep}
                </Badge>{" "}
                le 23 décembre 2024
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Articles de la commande</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <Image
                        src={`${process.env.ASSETS_URL}${item.image}`}
                        width={60}
                        height={60}
                        alt=""
                        unoptimized
                      />
                      <span>{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    €{item.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    €{(item.quantity * item.price).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
