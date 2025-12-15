"use client";

import React from "react";

import { CalendarPlus, Menu } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { UpcomingEvents } from "./upcoming-events";
import useCalendarEventStore from "../useCalendarEventStore";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function CalendarSidebar() {
  const { setOpenSheet } = useCalendarEventStore();

  return (
    <div className="sticky top-20 hidden space-y-4 xl:block">
      <Button onClick={() => setOpenSheet(true)} className="w-full">
        <CalendarPlus /> Ajouter un chantier
      </Button>
      <ScrollArea className="h-[calc(100vh-9.8rem)]">
        <UpcomingEvents />
      </ScrollArea>
    </div>
  );
}

export function CalendarMobileSidebar() {
  const { setOpenSheet } = useCalendarEventStore();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <DialogHeader>
          <DialogTitle>Chantiers à venir</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <UpcomingEvents />
        </div>
        <Button onClick={() => setOpenSheet(true)} className="w-full">
          <CalendarPlus /> Ajouter un chantier
        </Button>
      </SheetContent>
    </Sheet>
  );
}
