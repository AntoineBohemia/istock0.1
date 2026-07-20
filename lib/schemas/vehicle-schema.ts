import { z } from "zod";

export const VehicleFormSchema = z.object({
  name: z.string().min(2, {
    message: "Le nom doit contenir au moins 2 caracteres.",
  }),
  license_plate: z.string().min(2, {
    message: "La plaque d'immatriculation est requise.",
  }),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z
    .string()
    .optional()
    .refine((v) => !v || (!isNaN(parseInt(v)) && parseInt(v) >= 1900 && parseInt(v) <= 2100), {
      message: "Annee invalide.",
    }),
  fuel_type: z.enum(["diesel", "essence", "electrique", "hybride"]).optional(),
  mileage: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(parseInt(v)), {
      message: "Le kilometrage doit etre un nombre.",
    }),
  vin: z.string().optional(),
  technician_id: z.string().optional(),
  notes: z.string().optional(),
});

export type VehicleFormValues = z.infer<typeof VehicleFormSchema>;

export const DocumentUploadSchema = z.object({
  label: z.string().min(1, {
    message: "Le nom du document est requis.",
  }),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
});

export type DocumentUploadValues = z.infer<typeof DocumentUploadSchema>;
