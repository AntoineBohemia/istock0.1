import Link from "next/link";
import { Settings, SquarePenIcon } from "lucide-react";
import { CompleteYourProfileCard } from "./complete-your-profile";
import { generateMeta } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkills } from "./card-skills";
import { LatestActivity } from "./latest-activity";
import { AboutMe } from "./about-me";
import { Connections } from "./connections";
import { ProfileCard } from "./profile-card";

export async function generateMetadata() {
  return generateMeta({
    title: "Profile Page",
    description:
      "You can use the profile page template to show user details. Built with shadcn/ui components.",
    canonical: "/pages/profile",
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
          Stern Thireau
        </h1>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/users">
              <SquarePenIcon />
              Modifier
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="projects">Historique des fluxs</TabsTrigger>
          <TabsTrigger value="activities">Chantiers</TabsTrigger>
          <TabsTrigger value="members">ava</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-1">
          <ProfileCard />
        </div>
        <div className="space-y-4 xl:col-span-2">
          <LatestActivity />
        </div>
      </div>
    </div>
  );
}
