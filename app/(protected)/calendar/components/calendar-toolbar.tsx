"use client";

import React from "react";

import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { CalendarMobileSidebar } from "./calendar-sidebar";
import FullCalendar from "@fullcalendar/react";
import { CalendarApi } from "@fullcalendar/core";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";

type Props = {
  calendarRef: React.RefObject<FullCalendar | null>;
};

const viewTypes = [
  {
    key: "dayGridMonth",
    name: "Mois",
  },
  {
    key: "timeGridWeek",
    name: "Semaine",
  },
  {
    key: "timeGridDay",
    name: "Jour",
  },
];

export default function CalendarToolbar({ calendarRef }: Props) {
  const [currentView, setCurrentView] = React.useState<string>("dayGridMonth");
  const { isMobile } = useSidebar();

  const getCalendarApi = (): CalendarApi | null => {
    return calendarRef.current ? calendarRef.current.getApi() : null;
  };

  const calendarGo = (value: string) => {
    const calendarApi = getCalendarApi();
    if (!calendarApi) return;

    if (value === "next") {
      calendarApi.next();
    }
    if (value === "prev") {
      calendarApi.prev();
    }
    if (value === "today") {
      calendarApi.today();
    }
  };

  const changeView = (viewName: string) => {
    getCalendarApi()?.changeView(viewName);
    setCurrentView(viewName);
  };

  const PrevAndNextButtons = () => {
    return (
      <div className="flex divide-x rounded-md border">
        <Button
          variant="ghost"
          className="rounded-none"
          onClick={() => calendarGo("prev")}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          className="rounded-none"
          onClick={() => calendarGo("next")}
        >
          <ChevronRight />
        </Button>
      </div>
    );
  };

  const ToggleButtonGroup = () => {
    return (
      <ToggleGroup
        defaultValue={viewTypes.find((t) => t.key === currentView)?.key}
        onValueChange={(value) => changeView(value)}
        className="gap-0 divide-x overflow-hidden rounded-lg border"
        type="single"
      >
        {viewTypes.map((view, key) => (
          <ToggleGroupItem key={key} value={view.key} className="rounded-none">
            {view.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  };

  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isMobile ? <CalendarMobileSidebar /> : null}
        <div className="hidden md:block">
          <PrevAndNextButtons />
        </div>
        <Button
          className="hidden md:flex"
          variant="outline"
          onClick={() => calendarGo("today")}
        >
          Aujourd'hui
        </Button>
      </div>
      <div className="lg:text-xl">{getCalendarApi()?.view?.title}</div>
      <div className="hidden lg:block">
        <ToggleButtonGroup />
      </div>
      <div className="block lg:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings2 />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-full gap-4">
            <div className="block md:hidden">
              <PrevAndNextButtons />
            </div>
            <div>
              <ToggleButtonGroup />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
