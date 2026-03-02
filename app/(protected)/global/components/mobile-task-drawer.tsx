"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ActionTaskList } from "./action-task-list";
import { useDashboardTasks } from "@/hooks/queries";

export function MobileTaskDrawer() {
  const [open, setOpen] = useState(false);
  const { data: tasks = [] } = useDashboardTasks();
  const taskCount = tasks.length;

  // Close drawer on navigation (user clicked an action link)
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname && open) {
      setOpen(false);
    }
    prevPathname.current = pathname;
  }, [pathname, open]);

  return (
    <>
      {/* FAB button */}
      <Button
        size="icon"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-40 size-14 rounded-full shadow-lg sm:bottom-6 lg:hidden"
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

      {/* Drawer */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="!max-h-[92vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-center gap-2">
              <DrawerTitle>À faire</DrawerTitle>
              {taskCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {taskCount}
                </Badge>
              )}
            </div>
            <DrawerDescription>
              Actions recommandées pour votre stock
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <ActionTaskList embedded />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
