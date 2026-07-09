"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import dynamic from "next/dynamic";

const MembersPage = dynamic(() => import("./members/page"), { ssr: false });
const OrganizationsPage = dynamic(() => import("./organizations/page"), { ssr: false });

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("team");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground">
          Gérez votre équipe et vos organisations
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="team">Équipe</TabsTrigger>
          <TabsTrigger value="organizations">Organisations</TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="mt-6">
          <MembersPage />
        </TabsContent>
        <TabsContent value="organizations" className="mt-6">
          <OrganizationsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
