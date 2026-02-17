import { z } from "zod";

export const MovementFormSchema = z.object({
  direction: z.enum(["entry", "exit"]),
  exit_type: z.enum(["exit_technician", "exit_anonymous", "exit_loss"]).optional(),
  product_id: z.string().min(1, "Veuillez sélectionner un produit"),
  technician_id: z.string().optional(),
  quantity: z.number().min(1, "La quantité doit être au moins 1"),
  notes: z.string().optional(),
});

export type MovementFormValues = z.infer<typeof MovementFormSchema>;
