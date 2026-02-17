import { z } from "zod";

export const ProductFormSchema = z.object({
  name: z.string().min(2, {
    message: "Le nom du produit doit contenir au moins 2 caractères.",
  }),
  sku: z.string().optional(),
  description: z.string().optional(),
  price: z
    .string()
    .optional()
    .refine(
      (val) => !val || !Number.isNaN(parseFloat(val)),
      { message: "Le prix doit être un nombre valide." }
    ),
  stock_current: z
    .string()
    .optional()
    .refine(
      (val) => !val || !Number.isNaN(parseInt(val, 10)),
      { message: "Le stock doit être un nombre valide." }
    ),
  stock_min: z
    .string()
    .optional()
    .refine(
      (val) => !val || !Number.isNaN(parseInt(val, 10)),
      { message: "Le stock minimum doit être un nombre valide." }
    ),
  stock_max: z
    .string()
    .optional()
    .refine(
      (val) => !val || !Number.isNaN(parseInt(val, 10)),
      { message: "Le stock maximum doit être un nombre valide." }
    ),
  category_id: z.string().optional(),
  supplier_name: z.string().optional(),
  is_perishable: z.boolean(),
  track_stock: z.boolean(),
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;
