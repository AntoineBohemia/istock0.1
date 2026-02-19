"use client";

import { useState } from "react";
import { PackagePlus, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

import { HealthScoreHeader } from "./components/health-score-header";
import { DashboardTabs } from "./components/dashboard-tabs";
import { ActionTaskList } from "./components/action-task-list";
import { MobileTaskDrawer } from "./components/mobile-task-drawer";

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

  const handleRestockClick = (techId: string) => {
    setSelectedTechId(techId);
    setRestockOpen(true);
  };

  const handleRestockClose = (open: boolean) => {
    setRestockOpen(open);
    if (!open) setSelectedTechId(null);
  };

  return (
    <>
      {/* Page header */}
      <div className="mb-4 flex flex-row items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground hidden sm:block">
            Vue d&apos;ensemble de votre gestion de stock
          </p>
        </div>
        <Button size="lg" onClick={() => setTechPickerOpen(true)}>
          <PackagePlus className="size-5" />
          <span className="hidden sm:inline">Restocker un technicien</span>
          <span className="sm:hidden">Restocker</span>
        </Button>
      </div>

      {/* ─── Zone 1: Score + KPIs (full width) ─── */}
      <HealthScoreHeader orgId={orgId} />

      {/* ─── Desktop: Zone 2 (tabs) + Zone 3 (task list) ─── */}
      <div className="mt-6 hidden lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
        <div className="min-w-0">
          <DashboardTabs onRestockClick={handleRestockClick} />
        </div>
        <aside className="sticky top-20 self-start">
          <ActionTaskList />
        </aside>
      </div>

      {/* ─── Mobile: Zone 2 (tabs) + Zone 3 (FAB drawer) ─── */}
      <div className="mt-4 lg:hidden">
        <DashboardTabs onRestockClick={handleRestockClick} />
        <MobileTaskDrawer />
      </div>

      {/* Technician picker dialog */}
      <Dialog open={techPickerOpen} onOpenChange={setTechPickerOpen}>
        <DialogContent className="p-0 sm:max-w-md">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Restocker un technicien</DialogTitle>
            <DialogDescription>
              Selectionnez le technicien a restocker
            </DialogDescription>
          </DialogHeader>
          <Command className="border-t">
            <CommandInput placeholder="Rechercher un technicien..." />
            <CommandList>
              <CommandEmpty>Aucun technicien trouve.</CommandEmpty>
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

      {/* Restock dialog */}
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
