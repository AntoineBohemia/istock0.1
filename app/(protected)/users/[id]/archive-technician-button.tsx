"use client";

import ArchiveButton from "@/components/archive-button";
import { archiveTechnician } from "@/lib/supabase/queries/technicians";
import { useCurrentOrgId } from "@/lib/stores/organization-store";

interface ArchiveTechnicianButtonProps {
  technicianId: string;
  technicianName: string;
}

export default function ArchiveTechnicianButton({
  technicianId,
  technicianName,
}: ArchiveTechnicianButtonProps) {
  const orgId = useCurrentOrgId();

  return (
    <ArchiveButton
      entityLabel="le technicien"
      entityName={technicianName}
      onArchive={() => archiveTechnician(technicianId, orgId ?? undefined)}
      redirectTo="/users"
    />
  );
}
