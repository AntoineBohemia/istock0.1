import { z } from "zod";

export const MovementFormSchema = z.object({
  direction: z.enum(["entry", "exit"]),
  // exit_loss = « erreur de stock » (casse, perte, ecart d'inventaire). Le
  // schema l'omettait alors que l'interface mobile l'envoie et que la base
  // l'accepte : une saisie de ce type etait rejetee avant meme d'etre tentee.
  exit_type: z.enum(["exit_technician", "exit_anonymous", "exit_loss"]).optional(),
  product_id: z.string().min(1, "Veuillez sélectionner un produit"),
  technician_id: z.string().optional(),
  quantity: z.number().min(1, "La quantité doit être au moins 1"),
});

export type MovementFormValues = z.infer<typeof MovementFormSchema>;
