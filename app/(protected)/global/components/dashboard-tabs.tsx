"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { TabApercu } from "./tab-apercu";
import { TabProduits } from "./tab-produits";
import { TabTechniciens } from "./tab-techniciens";
import { TabFlux } from "./tab-flux";

interface DashboardTabsProps {
  onRestockClick: (techId: string) => void;
}

export function DashboardTabs({ onRestockClick }: DashboardTabsProps) {
  return (
    <Tabs defaultValue="apercu" className="w-full">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="apercu">
          <span className="hidden sm:inline">Apercu</span>
          <span className="sm:hidden">Vue</span>
        </TabsTrigger>
        <TabsTrigger value="produits">
          <span className="hidden sm:inline">Produits</span>
          <span className="sm:hidden">Prod.</span>
        </TabsTrigger>
        <TabsTrigger value="techniciens">
          <span className="hidden sm:inline">Techniciens</span>
          <span className="sm:hidden">Tech.</span>
        </TabsTrigger>
        <TabsTrigger value="flux">Flux</TabsTrigger>
      </TabsList>

      <Card className="mt-3">
        <CardContent className="p-4 lg:p-6">
          <TabsContent value="apercu" className="mt-0">
            <TabApercu />
          </TabsContent>

          <TabsContent value="produits" className="mt-0">
            <TabProduits />
          </TabsContent>

          <TabsContent value="techniciens" className="mt-0">
            <TabTechniciens onRestockClick={onRestockClick} />
          </TabsContent>

          <TabsContent value="flux" className="mt-0">
            <TabFlux />
          </TabsContent>
        </CardContent>
      </Card>
    </Tabs>
  );
}
