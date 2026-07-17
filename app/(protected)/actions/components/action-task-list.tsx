"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  TrendingDown,
  Clock,
  UserX,
  Moon,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import { useDashboardTasks } from "@/hooks/queries";
import { useTaskDismissStore } from "@/lib/stores/task-dismiss-store";
import type { DashboardTask } from "@/lib/supabase/queries/dashboard";

const INITIAL_COUNT = 5;

// ─── Config par type de tâche ────────────────────────────────────────

const TASK_ICONS: Record<
  string,
  { icon: typeof AlertTriangle; className: string; bgClassName: string }
> = {
  product_out_of_stock: {
    icon: AlertTriangle,
    className: "text-critique",
    bgClassName: "bg-critique-bg",
  },
  product_below_min: {
    icon: TrendingDown,
    className: "text-attention",
    bgClassName: "bg-attention-bg",
  },
  technician_late_restock: { icon: Clock, className: "text-primary", bgClassName: "bg-primary/10" },
  technician_never_restocked: {
    icon: UserX,
    className: "text-critique",
    bgClassName: "bg-critique-bg",
  },
  product_dormant: { icon: Moon, className: "text-muted-foreground", bgClassName: "bg-muted" },
};

const PRIORITY_BORDER: Record<string, string> = {
  critical: "border-l-critique",
  important: "border-l-attention",
  informational: "border-l-muted-foreground/30",
};

// ─── Config de groupes (ordre d'affichage) ───────────────────────────

interface TaskGroup {
  key: string;
  label: string;
  types: string[];
}

const TASK_GROUPS: TaskGroup[] = [
  { key: "stock_critical", label: "Ruptures de stock", types: ["product_out_of_stock"] },
  { key: "stock_low", label: "Stock faible", types: ["product_below_min"] },
  { key: "dormant", label: "Produits dormants", types: ["product_dormant"] },
];

// ─── Sous-composants ─────────────────────────────────────────────────

function TaskItem({ task, onDismiss }: { task: DashboardTask; onDismiss: () => void }) {
  const iconConfig = TASK_ICONS[task.type] ?? TASK_ICONS.product_dormant;
  const Icon = iconConfig.icon;
  const borderClass = PRIORITY_BORDER[task.priority] ?? PRIORITY_BORDER.informational;

  return (
    <Link
      href={task.action_url}
      className={cn(
        "group flex items-center gap-3 rounded-r-lg py-2 pr-2 pl-3 border-l-3 transition-colors cursor-pointer hover:bg-muted/50",
        borderClass
      )}
    >
      <div
        className={cn(
          "shrink-0 flex items-center justify-center rounded-full size-8",
          iconConfig.bgClassName
        )}
      >
        <Icon className={cn("size-4", iconConfig.className)} />
      </div>
      <p className="flex-1 min-w-0 text-sm truncate">{task.summary}</p>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        }}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        aria-label="Masquer cette tâche"
      >
        <X className="size-3.5" />
      </button>
    </Link>
  );
}

function TaskGroupSection({
  group,
  tasks,
  onDismiss,
}: {
  group: TaskGroup;
  tasks: DashboardTask[];
  onDismiss: (task: DashboardTask) => void;
}) {
  if (tasks.length === 0) return null;

  const firstType = tasks[0].type;
  const iconConfig = TASK_ICONS[firstType] ?? TASK_ICONS.product_dormant;
  const Icon = iconConfig.icon;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1 py-1">
        <Icon className={cn("size-3.5", iconConfig.className)} />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {group.label}
        </span>
        <span className="text-xs text-muted-foreground">({tasks.length})</span>
      </div>
      <div className="space-y-0.5">
        {tasks.map((task) => (
          <TaskItem key={task.group_key} task={task} onDismiss={() => onDismiss(task)} />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center gap-3 rounded-lg border-l-3 border-l-standard bg-standard-bg px-4 py-3">
      <CheckCircle className="size-5 shrink-0 text-standard" />
      <div>
        <p className="text-sm font-medium text-standard">Tout est en ordre</p>
        <p className="text-xs text-muted-foreground">Aucune action requise pour le moment</p>
      </div>
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────

export function ActionTaskList({ embedded = false }: { embedded?: boolean }) {
  const { data: tasks = [], isLoading } = useDashboardTasks();
  const { dismissTask } = useTaskDismissStore();
  const [showAll, setShowAll] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );

  const handleDismiss = (task: DashboardTask) => {
    task.entity_ids.forEach((entityId) => dismissTask(task.type, entityId));
  };

  const groupedTasks = useMemo(() => {
    const taskList = showAll ? tasks : tasks.slice(0, INITIAL_COUNT);
    return TASK_GROUPS.map((group) => ({
      group,
      tasks: taskList.filter((t) => group.types.includes(t.type)),
    })).filter(({ tasks: t }) => t.length > 0);
  }, [tasks, showAll]);

  const remaining = tasks.length - INITIAL_COUNT;

  if (isLoading) {
    const skeletonItems = (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2 pl-3">
            <Skeleton className="size-8 rounded-full shrink-0" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );

    if (embedded) {
      return skeletonItems;
    }
    return (
      <Card>
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base lg:text-lg">À faire</CardTitle>
        </CardHeader>
        <CardContent>{skeletonItems}</CardContent>
      </Card>
    );
  }

  const taskContent = (
    <>
      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {groupedTasks.map(({ group, tasks: groupTasks }) => (
            <TaskGroupSection
              key={group.key}
              group={group}
              tasks={groupTasks}
              onDismiss={handleDismiss}
            />
          ))}
          {remaining > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Voir les {remaining} autres tâches
            </button>
          )}
        </div>
      )}
    </>
  );

  if (embedded) {
    return taskContent;
  }

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base lg:text-lg">À faire</CardTitle>
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
          <CardContent className="pt-0">{taskContent}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
