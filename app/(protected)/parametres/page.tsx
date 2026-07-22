"use client";

import { useQueryState, parseAsStringLiteral } from "nuqs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import dynamic from "next/dynamic";

const MembersPage = dynamic(() => import("./equipe/page"), { ssr: false });
const OrganizationsPage = dynamic(() => import("./organisations/page"), { ssr: false });

// Les véhicules ont quitté les paramètres pour le menu principal : ils se
// gèrent au quotidien, ce n'est pas de la configuration.
const TAB_VALUES = ["team", "organizations"] as const;

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
        </TabsList>
        <div id="settings-action-slot" />
      </div>
      <TabsContent value="team" className="mt-6">
        <MembersPage />
      </TabsContent>
      <TabsContent value="organizations" className="mt-6">
        <OrganizationsPage />
      </TabsContent>
    </Tabs>
  );
}
