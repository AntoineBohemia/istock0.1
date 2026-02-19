"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  TrendingDown,
  Package,
  Clock,
  UserX,
  Moon,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import { useDashboardTasks } from "@/hooks/queries";
import { useTaskDismissStore } from "@/lib/stores/task-dismiss-store";
import type { DashboardTask } from "@/lib/supabase/queries/dashboard";

const INITIAL_COUNT = 5;

const TASK_ICONS: Record<string, { icon: typeof AlertTriangle; className: string }> = {
  product_out_of_stock: { icon: AlertTriangle, className: "text-red-500" },
  product_below_min: { icon: TrendingDown, className: "text-orange-500" },
  product_overstocked: { icon: Package, className: "text-orange-500" },
  technician_late_restock: { icon: Clock, className: "text-blue-500" },
  technician_never_restocked: { icon: UserX, className: "text-red-500" },
  product_dormant: { icon: Moon, className: "text-muted-foreground" },
};

const PRIORITY_BADGE: Record<string, { variant: "destructive" | "warning" | "secondary"; label: string }> = {
  critical: { variant: "destructive", label: "Critique" },
  important: { variant: "warning", label: "Important" },
  informational: { variant: "secondary", label: "Info" },
};

interface TaskItemProps {
  task: DashboardTask;
  onDismiss: () => void;
}

function TaskItem({ task, onDismiss }: TaskItemProps) {
  const iconConfig = TASK_ICONS[task.type] ?? TASK_ICONS.product_dormant;
  const Icon = iconConfig.icon;
  const badgeConfig = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.informational;

  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
      <div className={cn("shrink-0", iconConfig.className)}>
        <Icon className="size-4" />
      </div>
      <Link href={task.action_url} className="flex-1 min-w-0">
        <p className="text-sm truncate">{task.summary}</p>
      </Link>
      <Badge variant={badgeConfig.variant} className="shrink-0 text-[10px] px-1.5 py-0">
        {badgeConfig.label}
      </Badge>
      <button
        onClick={(e) => {
          e.preventDefault();
          onDismiss();
        }}
        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        aria-label="Masquer cette tâche"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <CheckCircle className="size-10 text-green-500 mb-3" />
      <p className="text-sm font-medium text-green-600 dark:text-green-400">
        Tout est en ordre
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Aucune action requise pour le moment
      </p>
    </div>
  );
}

export function ActionTaskList() {
  const { data: tasks = [], isLoading } = useDashboardTasks();
  const { dismissTask } = useTaskDismissStore();
  const [showAll, setShowAll] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleTasks = showAll ? tasks : tasks.slice(0, INITIAL_COUNT);
  const remaining = tasks.length - INITIAL_COUNT;

  const handleDismiss = (task: DashboardTask) => {
    task.entity_ids.forEach((entityId) => dismissTask(task.type, entityId));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base lg:text-lg">A faire</CardTitle>
        </CardHeader>
        <CardContent className="flex h-32 lg:h-48 items-center justify-center">
          <Loader2 className="size-6 lg:size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const taskContent = (
    <>
      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-1">
          {visibleTasks.map((task) => (
            <TaskItem
              key={task.group_key}
              task={task}
              onDismiss={() => handleDismiss(task)}
            />
          ))}
          {remaining > 0 && !showAll && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setShowAll(true)}
            >
              Voir les {remaining} autres tâches
            </Button>
          )}
        </div>
      )}
    </>
  );

  return (
    <Card>
      {/* Mobile: Collapsible */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="lg:hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">A faire</CardTitle>
                {tasks.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    {tasks.length}
                  </Badge>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="size-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {taskContent}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Desktop: Always visible */}
      <div className="hidden lg:block">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>A faire</CardTitle>
            {tasks.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {tasks.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {taskContent}
        </CardContent>
      </div>
    </Card>
  );
}
