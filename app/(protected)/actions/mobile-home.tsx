"use client";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { HealthScoreHeader } from "./components/health-score-header";
import { ActionTaskList } from "./components/action-task-list";

export default function MobileHome() {
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);

  return (
    <div className="space-y-4">
      <HealthScoreHeader orgId={orgId} />

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          À faire
        </h2>
        <ActionTaskList embedded />
      </div>
    </div>
  );
}
