import { generateMeta } from "@/lib/utils";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TechnicianForm from "../../nouveau/technician-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: technician } = await supabase
    .from("technicians")
    .select("first_name, last_name")
    .eq("id", id)
    .single();

  const name = technician
    ? `${technician.first_name} ${technician.last_name}`
    : "Technicien";

  return generateMeta({
    title: `Modifier - ${name}`,
    description: `Modifier les informations du technicien ${name}`,
    canonical: `/techniciens/${id}/modifier`,
  });
}

async function getTechnician(id: string) {
  const supabase = await createClient();

  const { data: technician, error } = await supabase
    .from("technicians")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !technician) {
    return null;
  }

  return technician;
}

export default async function EditTechnicianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const technician = await getTechnician(id);

  if (!technician) {
    notFound();
  }

  const initialData = {
    id: technician.id,
    first_name: technician.first_name,
    last_name: technician.last_name,
    email: technician.email ?? "",
    phone: technician.phone || "",
    city: technician.city || "",
    vehicle_plate: technician.vehicle_plate || "",
    vehicle_brand: technician.vehicle_brand || "",
    photo_url: technician.photo_url || null,
    organization_id: technician.organization_id || "",
    tablet_ref: technician.tablet_ref || "",
    clothing_size: technician.clothing_size || "",
  };

  return <TechnicianForm mode="edit" initialData={initialData} />;
}
