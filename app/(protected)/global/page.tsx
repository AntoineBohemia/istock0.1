"use client";

import { useState } from "react";
import { PackagePlus, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BalanceSummeryChart } from "./components/chart-balance-summary";
import { SuccessMetrics } from "@/app/(protected)/global/components";
import { RecentActivities } from "./components/recent-activities";
import { QuickActions } from "./components/quick-actions";
import { CompactStats } from "./components/compact-stats";
import { ActionTaskList } from "./components/action-task-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useTechnicians } from "@/hooks/queries";
import RestockDialog from "@/app/(protected)/users/[id]/restock-dialog";

export default function Page() {
  const [techPickerOpen, setTechPickerOpen] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [restockOpen, setRestockOpen] = useState(false);

  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const { data: technicians, isLoading: techLoading } = useTechnicians(orgId);

  const handleSelectTechnician = (techId: string) => {
    setSelectedTechId(techId);
    setTechPickerOpen(false);
    setRestockOpen(true);
  };

  const handleRestockClose = (open: boolean) => {
    setRestockOpen(open);
    if (!open) setSelectedTechId(null);
  };

  return (
    <>
      <div className="mb-4 flex flex-row items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground hidden sm:block">
            Vue d&apos;ensemble de votre gestion de stock
          </p>
        </div>
        <Button size="lg" onClick={() => setTechPickerOpen(true)}>
          <PackagePlus className="size-5" />
          Restocker un technicien
        </Button>
      </div>

      {/* Mobile Layout: Compact and efficient */}
      <div className="lg:hidden space-y-3">
        {/* Quick Actions - Most important on mobile */}
        <QuickActions />

        {/* Action Tasks */}
        <ActionTaskList />

        {/* Compact Stats Grid */}
        <CompactStats />

        {/* Recent Activities - Important for quick view */}
        <RecentActivities />

        {/* Technicians - Collapsible */}
        <SuccessMetrics />

        {/* Chart - Last on mobile, less critical */}
        <BalanceSummeryChart />
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block space-y-4">
        {/* Action Tasks - Full width */}
        <ActionTaskList />

        {/* Technicians (left) + Recent Activities (right) */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SuccessMetrics />
          <RecentActivities />
        </div>

        {/* Full width chart */}
        <BalanceSummeryChart />
      </div>

      {/* Step 1: Technician picker */}
      <Dialog open={techPickerOpen} onOpenChange={setTechPickerOpen}>
        <DialogContent className="p-0 sm:max-w-md">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Restocker un technicien</DialogTitle>
            <DialogDescription>
              Sélectionnez le technicien à restocker
            </DialogDescription>
          </DialogHeader>
          <Command className="border-t">
            <CommandInput placeholder="Rechercher un technicien..." />
            <CommandList>
              <CommandEmpty>Aucun technicien trouvé.</CommandEmpty>
              {techLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="text-muted-foreground size-5 animate-spin" />
                </div>
              ) : (
                <CommandGroup>
                  {technicians?.map((tech) => (
                    <CommandItem
                      key={tech.id}
                      value={`${tech.first_name} ${tech.last_name} ${tech.email ?? ""}`}
                      onSelect={() => handleSelectTechnician(tech.id)}
                    >
                      <Users className="mr-2 size-4 shrink-0" />
                      <span>
                        {tech.first_name} {tech.last_name}
                      </span>
                      {tech.city && (
                        <span className="text-muted-foreground ml-auto text-xs">
                          {tech.city}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Step 2: Restock dialog (same as technician page) */}
      {selectedTechId && (
        <RestockDialog
          technicianId={selectedTechId}
          open={restockOpen}
          onOpenChange={handleRestockClose}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
