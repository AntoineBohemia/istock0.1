import { generateMeta } from "@/lib/utils";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TechnicianForm from "../../create/technician-form";

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
    canonical: `/users/${id}/edit`,
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
    email: technician.email,
    phone: technician.phone || "",
    city: technician.city || "",
  };

  return <TechnicianForm mode="edit" initialData={initialData} />;
}
