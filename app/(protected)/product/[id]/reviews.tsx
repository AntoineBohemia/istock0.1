import { Button } from "@/components/ui/button";

const stockMovements = [
  {
    id: 1,
    type: "Entrée",
    quantity: "+200 L",
    description: "Réapprovisionnement fournisseur principal.",
    date: "Il y a 2 jours",
  },
  {
    id: 2,
    type: "Sortie",
    quantity: "-50 L",
    description: "Commande client chantier A.",
    date: "Il y a 1 jour",
  },
  {
    id: 3,
    type: "Réservation",
    quantity: "-30 L",
    description: "Réservé pour chantier B.",
    date: "Aujourd'hui",
  },
];

export default function ProductReviewList() {
  return (
    <div className="space-y-4">
      {stockMovements.map((movement) => (
        <div key={movement.id} className="grid gap-4 rounded-lg border p-4">
          <div className="flex items-start gap-4">
            <div className="grid grow gap-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{movement.type}</div>
                <div className="text-muted-foreground text-xs">
                  {movement.date}
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <div className="font-semibold">{movement.quantity}</div>
            <div className="text-muted-foreground text-sm">
              {movement.description}
            </div>
          </div>
        </div>
      ))}
      <div className="text-center">
        <Button variant="outline">Charger plus...</Button>
      </div>
    </div>
  );
}
