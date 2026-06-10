import dynamic from "next/dynamic";
import { generateMeta } from "@/lib/utils";
import CalendarSidebar from "./components/calendar-sidebar";
import EventSheet from "./components/event-sheet";
import React from "react";

const CalendarApp = dynamic(() => import("./components/calendar-app"));

export async function generateMetadata() {
  return generateMeta({
    title: "Calendar",
    description:
      "Plan your events or tasks in an organized way with the Calendar app template. Built with shadcn/ui, Next.js and Tailwind CSS.",
    canonical: "/apps/calendar",
  });
}

export default function Page() {
  return (
    <div className="flex lg:space-x-5">
      <CalendarSidebar />
      <div className="grow">
        <CalendarApp />
      </div>
      <EventSheet />
    </div>
  );
}
