"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ActionTaskList } from "./action-task-list";
import { useDashboardTasks } from "@/hooks/queries";

export function MobileTaskDrawer() {
  const [open, setOpen] = useState(false);
  const { data: tasks = [] } = useDashboardTasks();
  const taskCount = tasks.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-40 size-14 rounded-full shadow-lg lg:hidden"
        >
          <ClipboardList className="size-6" />
          {taskCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 size-5 p-0 flex items-center justify-center text-[10px]"
            >
              {taskCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>A faire</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <ActionTaskList />
        </div>
      </SheetContent>
    </Sheet>
  );
}
