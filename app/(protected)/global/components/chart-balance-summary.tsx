"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { CartesianGrid, XAxis, YAxis, Area, AreaChart, Bar, BarChart, Tooltip, TooltipProps, Cell, ReferenceLine } from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Loader2, Folder, Package, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useSpring, useMotionValueEvent } from "motion/react";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExportButton } from "@/components/CardActionMenus";
import {
  getDashboardStats,
  getGlobalStockEvolution,
  getProductStockEvolution,
  getCategoryStockEvolution,
  StockEvolutionData,
  DashboardStats,
  BreakdownItem,
  getCategoryBreakdown,
  getGlobalBreakdown,
} from "@/lib/supabase/queries/dashboard";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { Category, CategoryWithChildren } from "@/lib/supabase/queries/categories";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  stock_current?: number;
}

interface ProductWithStock extends Product {
  stock_current: number;
}

// Selection value format: "all" | "category:uuid" | "product:uuid"
type SelectionValue = string;

const colorStock = "hsl(var(--chart-1))";
const colorEntries = "hsl(var(--chart-2))";
const colorExits = "hsl(var(--chart-5))";

const chartConfig = {
  totalStock: {
    label: "Stock total",
    color: colorStock,
  },
  entries: {
    label: "Entrées",
    color: colorEntries,
  },
  exits: {
    label: "Sorties",
    color: colorExits,
  },
} satisfies ChartConfig;

// Custom tooltip component for hierarchical breakdown
interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  breakdown: BreakdownItem[];
  selectionLabel: string;
  selection: string;
}

function HierarchicalTooltipContent({
  active,
  payload,
  breakdown,
  selectionLabel,
  selection,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0]?.payload as (StockEvolutionData & { monthLabel: string }) | undefined;
  if (!data) return null;

  // Fonction récursive pour afficher les items
  const renderBreakdownItems = (items: BreakdownItem[], maxDepth: number = 3): React.ReactNode => {
    return items.map((item) => (
      <div key={item.id}>
        <div
          className="flex items-center justify-between gap-4 py-0.5"
          style={{ paddingLeft: `${item.depth * 12}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {item.type === "category" ? (
              <Folder className="size-3 shrink-0 text-muted-foreground" />
            ) : (
              <span className="text-[10px] text-muted-foreground">•</span>
            )}
            <span
              className={`truncate text-xs ${
                item.type === "category" ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {item.name}
            </span>
          </div>
          <span className="text-xs font-medium tabular-nums shrink-0">
            {item.stock.toLocaleString("fr-FR")}
          </span>
        </div>
        {item.children && item.depth < maxDepth && renderBreakdownItems(item.children, maxDepth)}
      </div>
    ));
  };

  return (
    <div className="rounded-lg border border-border/50 bg-muted p-3 shadow-lg min-w-[200px] max-w-[300px]">
      {/* Header avec la date */}
      <div className="mb-2 pb-2 border-b">
        <p className="text-sm font-medium">{data.monthLabel}</p>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between gap-4 mb-2 pb-2 border-b">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: colorStock }}
          />
          <span className="text-sm font-medium">{selectionLabel}</span>
        </div>
        <span className="text-sm font-bold tabular-nums">
          {data.totalStock.toLocaleString("fr-FR")}
        </span>
      </div>

      {/* Breakdown hiérarchique */}
      {breakdown.length > 0 && !selection.startsWith("product:") && (
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Détail
            </p>
            {renderBreakdownItems(breakdown)}
          </div>
        </ScrollArea>
      )}

      {/* Entrées/Sorties */}
      <div className="mt-2 pt-2 border-t space-y-1">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: colorEntries }}
            />
            <span className="text-xs text-muted-foreground">Entrées</span>
          </div>
          <span className="text-xs font-medium text-green-600 tabular-nums">
            +{data.entries.toLocaleString("fr-FR")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: colorExits }}
            />
            <span className="text-xs text-muted-foreground">Sorties</span>
          </div>
          <span className="text-xs font-medium text-red-600 tabular-nums">
            -{data.exits.toLocaleString("fr-FR")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function BalanceSummeryChart() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const [axis, setAxis] = useState(0);
  const [displayValue, setDisplayValue] = useState(0);

  // Bar chart state
  const [activeBarIndex, setActiveBarIndex] = useState<number | undefined>(undefined);
  const [barDisplayEntries, setBarDisplayEntries] = useState(0);
  const [barDisplayExits, setBarDisplayExits] = useState(0);

  // Spring animations for area chart
  const springX = useSpring(0, { damping: 30, stiffness: 100 });
  const springY = useSpring(0, { damping: 30, stiffness: 100 });

  // Spring animations for bar chart
  const springEntries = useSpring(0, { damping: 25, stiffness: 120 });
  const springExits = useSpring(0, { damping: 25, stiffness: 120 });

  useMotionValueEvent(springX, "change", (latest) => {
    setAxis(latest);
  });

  useMotionValueEvent(springY, "change", (latest) => {
    setDisplayValue(Math.round(latest));
  });

  useMotionValueEvent(springEntries, "change", (latest) => {
    setBarDisplayEntries(Math.round(latest));
  });

  useMotionValueEvent(springExits, "change", (latest) => {
    setBarDisplayExits(Math.round(latest));
  });

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<StockEvolutionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  // Data
  const [categoriesTree, setCategoriesTree] = useState<CategoryWithChildren[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsWithStock, setProductsWithStock] = useState<ProductWithStock[]>([]);

  // Breakdown data for tooltip
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);

  // Single selection value: "all", "category:uuid", or "product:uuid"
  const [selection, setSelection] = useState<SelectionValue>("all");

  // Calculate trend
  const trend = useMemo(() => {
    if (chartData.length < 2) return { value: 0, isPositive: true };
    const lastMonth = chartData[chartData.length - 1]?.totalStock || 0;
    const prevMonth = chartData[chartData.length - 2]?.totalStock || 1;
    const change = ((lastMonth - prevMonth) / prevMonth) * 100;
    return { value: Math.abs(change).toFixed(1), isPositive: change >= 0 };
  }, [chartData]);

  // Charger les données initiales
  useEffect(() => {
    async function loadData() {
      if (!currentOrganization) return;

      try {
        const supabase = createClient();

        const [statsData, evolutionData, categoriesData, productsData] = await Promise.all([
          getDashboardStats(currentOrganization.id),
          getGlobalStockEvolution(6, currentOrganization.id),
          supabase
            .from("categories")
            .select("*")
            .eq("organization_id", currentOrganization.id)
            .order("name"),
          supabase
            .from("products")
            .select("id, name, sku, category_id, stock_current")
            .eq("organization_id", currentOrganization.id)
            .order("name"),
        ]);

        setStats(statsData);
        setChartData(evolutionData);

        // Initialize spring with last value
        if (evolutionData.length > 0) {
          const lastValue = evolutionData[evolutionData.length - 1].totalStock;
          springY.jump(lastValue);
          setDisplayValue(lastValue);
        }

        // Build categories tree
        const categories = categoriesData.data || [];
        setAllCategories(categories);

        const categoryMap = new Map<string, CategoryWithChildren>();
        const rootCategories: CategoryWithChildren[] = [];

        categories.forEach((cat) => {
          categoryMap.set(cat.id, { ...cat, children: [] });
        });

        categories.forEach((cat) => {
          const category = categoryMap.get(cat.id)!;
          if (cat.parent_id && categoryMap.has(cat.parent_id)) {
            categoryMap.get(cat.parent_id)!.children!.push(category);
          } else {
            rootCategories.push(category);
          }
        });

        setCategoriesTree(rootCategories);

        const prods = productsData.data || [];
        setProducts(prods);
        setProductsWithStock(
          prods.map((p) => ({ ...p, stock_current: p.stock_current || 0 }))
        );

        // Initial breakdown (global)
        const initialBreakdown = await getGlobalBreakdown(
          categories,
          categories,
          prods.map((p) => ({ ...p, stock_current: p.stock_current || 0 }))
        );
        setBreakdown(initialBreakdown);
      } catch (error) {
        console.error("Error loading chart data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (!isOrgLoading && currentOrganization) {
      loadData();
    }
  }, [currentOrganization?.id, isOrgLoading]);

  // Initialize axis position after chart renders
  useEffect(() => {
    if (chartRef.current && !isLoading) {
      const width = chartRef.current.getBoundingClientRect().width;
      springX.jump(width);
      setAxis(width);
    }
  }, [isLoading, chartData]);

  // Recharger les données du graphique et le breakdown quand la sélection change
  useEffect(() => {
    async function loadChartData() {
      if (isLoading || !currentOrganization) return;

      setIsLoadingChart(true);
      try {
        let evolutionData: StockEvolutionData[];
        let newBreakdown: BreakdownItem[] = [];

        if (selection === "all") {
          evolutionData = await getGlobalStockEvolution(6, currentOrganization.id);
          newBreakdown = await getGlobalBreakdown(
            allCategories,
            allCategories,
            productsWithStock
          );
        } else if (selection.startsWith("category:")) {
          const categoryId = selection.replace("category:", "");
          evolutionData = await getCategoryStockEvolution(categoryId, 6);
          newBreakdown = await getCategoryBreakdown(
            categoryId,
            allCategories,
            productsWithStock
          );
        } else if (selection.startsWith("product:")) {
          const productId = selection.replace("product:", "");
          evolutionData = await getProductStockEvolution(productId, 6);
          newBreakdown = [];
        } else {
          evolutionData = await getGlobalStockEvolution(6, currentOrganization.id);
          newBreakdown = await getGlobalBreakdown(
            allCategories,
            allCategories,
            productsWithStock
          );
        }

        setChartData(evolutionData);
        setBreakdown(newBreakdown);

        // Update spring with new last value
        if (evolutionData.length > 0) {
          const lastValue = evolutionData[evolutionData.length - 1].totalStock;
          springY.jump(lastValue);
          setDisplayValue(lastValue);
        }
      } catch (error) {
        console.error("Error loading chart data:", error);
      } finally {
        setIsLoadingChart(false);
      }
    }
    loadChartData();
  }, [selection, isLoading, allCategories, productsWithStock, currentOrganization?.id]);

  // Construire la liste hiérarchique pour le select
  const hierarchicalItems = useMemo(() => {
    const items: Array<{
      type: "category" | "product" | "uncategorized-label";
      id: string;
      name: string;
      depth: number;
    }> = [];

    const productsByCategory = new Map<string | null, Product[]>();
    products.forEach((product) => {
      const catId = product.category_id;
      if (!productsByCategory.has(catId)) {
        productsByCategory.set(catId, []);
      }
      productsByCategory.get(catId)!.push(product);
    });

    function addCategoryAndProducts(category: CategoryWithChildren, depth: number) {
      items.push({
        type: "category",
        id: category.id,
        name: category.name,
        depth,
      });

      const categoryProducts = productsByCategory.get(category.id) || [];
      categoryProducts.forEach((product) => {
        items.push({
          type: "product",
          id: product.id,
          name: product.name,
          depth: depth + 1,
        });
      });

      if (category.children && category.children.length > 0) {
        category.children.forEach((child) => {
          addCategoryAndProducts(child, depth + 1);
        });
      }
    }

    categoriesTree.forEach((rootCategory) => {
      addCategoryAndProducts(rootCategory, 0);
    });

    const uncategorizedProducts = productsByCategory.get(null) || [];
    if (uncategorizedProducts.length > 0) {
      items.push({
        type: "uncategorized-label",
        id: "uncategorized",
        name: "Sans catégorie",
        depth: 0,
      });
      uncategorizedProducts.forEach((product) => {
        items.push({
          type: "product",
          id: product.id,
          name: product.name,
          depth: 1,
        });
      });
    }

    return items;
  }, [categoriesTree, products]);

  const selectionLabel = useMemo(() => {
    if (selection === "all") return "Stock global";
    if (selection.startsWith("category:")) {
      const categoryId = selection.replace("category:", "");
      const category = allCategories.find((c) => c.id === categoryId);
      return category?.name || "Catégorie";
    }
    if (selection.startsWith("product:")) {
      const productId = selection.replace("product:", "");
      const product = products.find((p) => p.id === productId);
      return product?.name || "Produit";
    }
    return "Stock global";
  }, [selection, allCategories, products]);

  const formattedChartData = chartData.map((d) => {
    const [year, month] = d.date.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return {
      ...d,
      monthLabel: format(date, "MMM yy", { locale: fr }),
    };
  });

  const CustomTooltip = useCallback(
    (props: TooltipProps<ValueType, NameType>) => (
      <HierarchicalTooltipContent
        {...props}
        breakdown={breakdown}
        selectionLabel={selectionLabel}
        selection={selection}
      />
    ),
    [breakdown, selectionLabel, selection]
  );

  if (isLoading || isOrgLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Evolution du stock</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[400px] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              <span className="text-3xl font-bold tabular-nums">
                {displayValue.toLocaleString("fr-FR")}
              </span>
              <Badge
                variant="secondary"
                className={`${
                  trend.isPositive
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {trend.isPositive ? (
                  <TrendingUp className="mr-1 size-3" />
                ) : (
                  <TrendingDown className="mr-1 size-3" />
                )}
                {trend.isPositive ? "+" : "-"}{trend.value}%
              </Badge>
            </CardTitle>
            <CardDescription>
              {selection === "all" ? "Vue globale de tous les produits" : selectionLabel}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="selection-select" className="text-xs text-muted-foreground whitespace-nowrap">
                Filtrer
              </Label>
              <Select value={selection} onValueChange={setSelection}>
                <SelectTrigger id="selection-select" className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all" className="font-medium">
                    <div className="flex items-center gap-2">
                      <Package className="size-3.5" />
                      <span>Tous les produits</span>
                    </div>
                  </SelectItem>

                  {hierarchicalItems.map((item) => {
                    if (item.type === "uncategorized-label") {
                      return (
                        <div
                          key={item.id}
                          className="px-2 py-1.5 text-xs font-medium text-muted-foreground"
                        >
                          {item.name}
                        </div>
                      );
                    }

                    if (item.type === "category") {
                      return (
                        <SelectItem
                          key={`cat-${item.id}`}
                          value={`category:${item.id}`}
                          className="font-medium text-foreground"
                        >
                          <div
                            className="flex items-center gap-2"
                            style={{ paddingLeft: `${item.depth * 12}px` }}
                          >
                            <Folder className="size-3.5" />
                            <span>{item.name}</span>
                          </div>
                        </SelectItem>
                      );
                    }

                    return (
                      <SelectItem
                        key={`prod-${item.id}`}
                        value={`product:${item.id}`}
                        className="text-muted-foreground"
                      >
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingLeft: `${item.depth * 12}px` }}
                        >
                          <span className="text-xs">•</span>
                          <span>{item.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <ExportButton />
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative">
        {selection === "all" && (
          <div className="mb-8 grid gap-3 text-sm md:grid-cols-2 lg:max-w-(--breakpoint-sm) lg:grid-cols-4">
            <div className="rounded-xl border bg-gradient-to-br from-background to-muted/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div
                  className="size-2 rounded-full"
                  style={{
                    backgroundColor: colorStock,
                    boxShadow: `0 0 0 4px hsl(var(--chart-1) / 0.15)`
                  }}
                />
                <span className="text-xs font-medium uppercase tracking-wide">Stock actuel</span>
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
                {stats?.totalStock.toLocaleString("fr-FR")}
              </div>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-background to-muted/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div
                  className="size-2 rounded-full"
                  style={{
                    backgroundColor: "hsl(217 91% 60%)",
                    boxShadow: `0 0 0 4px hsl(217 91% 60% / 0.15)`
                  }}
                />
                <span className="text-xs font-medium uppercase tracking-wide">Valeur totale</span>
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
                {stats?.totalValue.toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-background to-green-500/5 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div
                  className="size-2 rounded-full"
                  style={{
                    backgroundColor: colorEntries,
                    boxShadow: `0 0 0 4px hsl(var(--chart-2) / 0.15)`
                  }}
                />
                <span className="text-xs font-medium uppercase tracking-wide">Entrées (mois)</span>
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-green-600 dark:text-green-400">
                +{stats?.monthlyEntries.toLocaleString("fr-FR")}
              </div>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-background to-red-500/5 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div
                  className="size-2 rounded-full"
                  style={{
                    backgroundColor: colorExits,
                    boxShadow: `0 0 0 4px hsl(var(--chart-5) / 0.15)`
                  }}
                />
                <span className="text-xs font-medium uppercase tracking-wide">Sorties (mois)</span>
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-red-600 dark:text-red-400">
                -{stats?.monthlyExits.toLocaleString("fr-FR")}
              </div>
            </div>
          </div>
        )}

        {isLoadingChart && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {formattedChartData.length > 0 ? (
          <ChartContainer
            ref={chartRef}
            className="w-full h-[300px]"
            config={chartConfig}
          >
            <AreaChart
              className="overflow-visible"
              accessibilityLayer
              data={formattedChartData}
              onMouseMove={(state) => {
                const x = state.activeCoordinate?.x;
                const dataValue = state.activePayload?.[0]?.value as number | undefined;
                if (x !== undefined && dataValue !== undefined) {
                  springX.set(x);
                  springY.set(dataValue);
                }
              }}
              onMouseLeave={() => {
                if (chartRef.current) {
                  springX.set(chartRef.current.getBoundingClientRect().width);
                }
                if (formattedChartData.length > 0) {
                  springY.set(formattedChartData[formattedChartData.length - 1].totalStock);
                }
              }}
              margin={{ left: 12, right: 12 }}
            >
              <defs>
                <linearGradient id="gradient-stock" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorStock} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={colorStock} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradient-stock-faded" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorStock} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={colorStock} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                className="stroke-muted"
              />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
                tickFormatter={(value) => value.toLocaleString("fr-FR")}
              />
              <Tooltip
                cursor={{ stroke: colorStock, strokeWidth: 1, strokeDasharray: "4 4" }}
                content={CustomTooltip}
              />
              {/* Background area (faded) */}
              <Area
                dataKey="totalStock"
                type="monotone"
                fill="url(#gradient-stock-faded)"
                stroke={colorStock}
                strokeWidth={2}
                strokeOpacity={0.3}
                dot={false}
                activeDot={false}
              />
              {/* Clipped area (animated reveal) */}
              <Area
                dataKey="totalStock"
                type="monotone"
                fill="url(#gradient-stock)"
                stroke={colorStock}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: colorStock,
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
                style={{
                  clipPath: chartRef.current
                    ? `inset(0 ${chartRef.current.getBoundingClientRect().width - axis}px 0 0)`
                    : undefined,
                }}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Aucune donnée disponible
          </div>
        )}

        {/* Entrées/Sorties bar chart */}
        {formattedChartData.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium">Flux mensuels</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: colorEntries }}
                  />
                  <span className="text-muted-foreground">Entrées</span>
                  <span className="font-semibold text-green-600 tabular-nums">
                    +{barDisplayEntries.toLocaleString("fr-FR")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: colorExits }}
                  />
                  <span className="text-muted-foreground">Sorties</span>
                  <span className="font-semibold text-red-600 tabular-nums">
                    -{barDisplayExits.toLocaleString("fr-FR")}
                  </span>
                </div>
              </div>
            </div>
            <ChartContainer className="w-full h-[150px]" config={chartConfig}>
              <BarChart
                accessibilityLayer
                data={formattedChartData}
                margin={{ left: 12, right: 12 }}
                onMouseLeave={() => {
                  setActiveBarIndex(undefined);
                  // Reset to totals
                  const totalEntries = formattedChartData.reduce((sum, d) => sum + d.entries, 0);
                  const totalExits = formattedChartData.reduce((sum, d) => sum + d.exits, 0);
                  springEntries.set(totalEntries);
                  springExits.set(totalExits);
                }}
              >
                <defs>
                  <linearGradient id="gradient-entries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colorEntries} stopOpacity={1} />
                    <stop offset="100%" stopColor={colorEntries} stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="gradient-exits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colorExits} stopOpacity={1} />
                    <stop offset="100%" stopColor={colorExits} stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="monthLabel"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs"
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border/50 bg-muted p-2 shadow-lg">
                          <p className="text-xs font-medium mb-1">{data.monthLabel}</p>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full" style={{ backgroundColor: colorEntries }} />
                                <span className="text-xs text-muted-foreground">Entrées</span>
                              </div>
                              <span className="text-xs font-medium text-green-600">+{data.entries.toLocaleString("fr-FR")}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full" style={{ backgroundColor: colorExits }} />
                                <span className="text-xs text-muted-foreground">Sorties</span>
                              </div>
                              <span className="text-xs font-medium text-red-600">-{data.exits.toLocaleString("fr-FR")}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="entries" fill="url(#gradient-entries)" radius={[4, 4, 0, 0]}>
                  {formattedChartData.map((entry, index) => (
                    <Cell
                      key={`entries-${index}`}
                      className="transition-opacity duration-200"
                      opacity={activeBarIndex === undefined ? 1 : activeBarIndex === index ? 1 : 0.3}
                      onMouseEnter={() => {
                        setActiveBarIndex(index);
                        springEntries.set(entry.entries);
                        springExits.set(entry.exits);
                      }}
                    />
                  ))}
                </Bar>
                <Bar dataKey="exits" fill="url(#gradient-exits)" radius={[4, 4, 0, 0]}>
                  {formattedChartData.map((entry, index) => (
                    <Cell
                      key={`exits-${index}`}
                      className="transition-opacity duration-200"
                      opacity={activeBarIndex === undefined ? 1 : activeBarIndex === index ? 1 : 0.3}
                      onMouseEnter={() => {
                        setActiveBarIndex(index);
                        springEntries.set(entry.entries);
                        springExits.set(entry.exits);
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
