"use client";

import { useQueryState, parseAsStringLiteral } from "nuqs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import dynamic from "next/dynamic";

const MembersPage = dynamic(() => import("./equipe/page"), { ssr: false });
const OrganizationsPage = dynamic(() => import("./organisations/page"), { ssr: false });
const VehiclesPage = dynamic(() => import("./vehicules/page"), { ssr: false });

const TAB_VALUES = ["team", "organizations", "vehicles"] as const;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TAB_VALUES).withDefault("team")
  );

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as (typeof TAB_VALUES)[number])}>
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="team">Équipe</TabsTrigger>
          <TabsTrigger value="organizations">Organisations</TabsTrigger>
          <TabsTrigger value="vehicles">Véhicules</TabsTrigger>
        </TabsList>
        <div id="settings-action-slot" />
      </div>
      <TabsContent value="team" className="mt-6">
        <MembersPage />
      </TabsContent>
      <TabsContent value="organizations" className="mt-6">
        <OrganizationsPage />
      </TabsContent>
      <TabsContent value="vehicles" className="mt-6">
        <VehiclesPage />
      </TabsContent>
    </Tabs>
  );
}
