import { z } from "zod";

export const TechnicianFormSchema = z.object({
  first_name: z.string().min(2, {
    message: "Le prénom doit contenir au moins 2 caractères.",
  }),
  last_name: z.string().min(2, {
    message: "Le nom doit contenir au moins 2 caractères.",
  }),
  email: z.string().email({
    message: "Veuillez entrer une adresse email valide.",
  }),
  phone: z.string().optional(),
  city: z.string().optional(),
});

export type TechnicianFormValues = z.infer<typeof TechnicianFormSchema>;
