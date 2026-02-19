"use client";

import { useState, useMemo } from "react";
import {
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  AreaChart,
  ReferenceArea,
  Bar,
  BarChart,
} from "recharts";
import { Loader2, Package, Folder, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { calculateStockScore } from "@/lib/utils/stock";
import {
  getProductStockEvolution,
  type StockEvolutionData,
} from "@/lib/supabase/queries/dashboard";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import {
  useHealthScore,
  useHealthScoreHistory,
  useGlobalStockEvolution,
} from "@/hooks/queries";
import { useCategories } from "@/hooks/queries";
import { useProducts } from "@/hooks/queries";
import { useQueries } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";

// ─── Types ──────────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  stock_min: number | null;
  stock_max: number | null;
}

interface ScoreChartPoint {
  month: string;
  monthLabel: string;
  [key: string]: number | string;
}

// ─── Constants ──────────────────────────────────────────────────────
const PRODUCT_COLORS = [
  "hsl(220, 90%, 55%)",
  "hsl(142, 76%, 36%)",
  "hsl(280, 70%, 50%)",
  "hsl(32, 95%, 44%)",
  "hsl(184, 92%, 33%)",
  "hsl(340, 80%, 55%)",
];
const MAX_PRODUCTS = 6;

const ZONE_RED = "hsl(0 84% 60% / 0.08)";
const ZONE_ORANGE = "hsl(32 95% 44% / 0.08)";
const ZONE_GREEN = "hsl(142 76% 36% / 0.08)";

// ─── Score label helper ─────────────────────────────────────────────
function getScoreLabel(score: number): string {
  if (score >= 90) return "Sous controle";
  if (score >= 70) return "Quelques points d'attention";
  if (score >= 40) return "Situation degradee";
  return "Action urgente requise";
}

// ─── Tooltips ───────────────────────────────────────────────────────
function ScoreTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  // Multi-product mode: show each product score
  if (payload.length > 1 || (payload[0]?.dataKey && payload[0].dataKey !== "score")) {
    return (
      <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="text-sm">
            <span
              className="inline-block size-2 rounded-full mr-1.5"
              style={{ backgroundColor: p.color || p.stroke }}
            />
            {p.name}: {Math.round(p.value)}/100
          </p>
        ))}
      </div>
    );
  }

  // Global score mode
  const score = payload[0].value as number;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">
        {score}/100 — {getScoreLabel(score)}
      </p>
    </div>
  );
}

function FlowTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-sm">
          <span
            className="inline-block size-2 rounded-full mr-1.5"
            style={{ backgroundColor: p.color }}
          />
          {p.name}: {p.value?.toLocaleString("fr-FR")}
        </p>
      ))}
    </div>
  );
}

// ─── Flow chart config ──────────────────────────────────────────────
const flowChartConfig = {
  entries: { label: "Entrees", color: "hsl(160 84% 39%)" },
  exits: { label: "Sorties", color: "hsl(350 89% 60%)" },
} satisfies ChartConfig;

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════
export function TabApercu() {
  const { currentOrganization } = useOrganizationStore();
  const orgId = currentOrganization?.id;

  // Data hooks
  const { data: healthScore, isLoading: isScoreLoading } = useHealthScore(orgId);
  const { data: historyRaw = [], isLoading: isHistoryLoading } = useHealthScoreHistory(orgId, 6);
  const { data: globalChartData = [], isLoading: isEvolutionLoading } = useGlobalStockEvolution(orgId, 6);
  const { data: categoriesData = [] } = useCategories(orgId);
  const { data: productsResult } = useProducts({ organizationId: orgId, pageSize: 1000 });

  const isLoading = isScoreLoading || isHistoryLoading || isEvolutionLoading;

  // Products with stock_min/stock_max for score calculation
  const products: Product[] = useMemo(
    () =>
      (productsResult?.products || []).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category_id: p.category_id,
        stock_min: p.stock_min,
        stock_max: p.stock_max,
      })),
    [productsResult]
  );

  // Filter state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  const hasProductFilter = selectedProductIds.length > 0;

  // ─── Per-product stock evolution queries ──────────────────────────
  const productEvolutionQueries = useQueries({
    queries: selectedProductIds.map((productId) => ({
      queryKey: queryKeys.dashboard.productEvolution(productId, 6),
      queryFn: () => getProductStockEvolution(productId, 6),
      enabled: !!productId,
      staleTime: STALE_TIME.SLOW,
    })),
  });

  const isLoadingProducts = productEvolutionQueries.some((q) => q.isLoading);

  // ─── Build score chart data ───────────────────────────────────────
  const scoreChartConfig = useMemo(() => {
    const config: ChartConfig = {
      score: { label: "Score global", color: "hsl(var(--chart-1))" },
    };
    selectedProductIds.forEach((productId, index) => {
      const product = products.find((p) => p.id === productId);
      if (product) {
        config[productId] = {
          label: product.name,
          color: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
        };
      }
    });
    return config;
  }, [selectedProductIds, products]);

  // Global score chart data (health score history + live current month)
  const globalScoreData = useMemo((): ScoreChartPoint[] => {
    const data: ScoreChartPoint[] = historyRaw.map((m) => {
      const [year, month] = m.month.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return {
        month: m.month,
        monthLabel: format(date, "MMM yy", { locale: fr }),
        score: m.score,
      };
    });

    if (healthScore) {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      if (!data.some((d) => d.month === currentMonthKey)) {
        data.push({
          month: currentMonthKey,
          monthLabel: format(now, "MMM yy", { locale: fr }),
          score: healthScore.score,
        });
      }
    }

    return data;
  }, [historyRaw, healthScore]);

  // Per-product score chart data: calculate stock score for each month
  const productScoreData = useMemo((): ScoreChartPoint[] => {
    if (!hasProductFilter) return [];

    // Collect all product evolution data
    const productData: Record<string, StockEvolutionData[]> = {};
    selectedProductIds.forEach((productId, index) => {
      const result = productEvolutionQueries[index];
      if (result?.data) {
        productData[productId] = result.data;
      }
    });

    // Build merged chart data with stock scores per product per month
    const dateMap = new Map<string, ScoreChartPoint>();

    selectedProductIds.forEach((productId) => {
      const data = productData[productId] || [];
      const product = products.find((p) => p.id === productId);
      const stockMin = product?.stock_min ?? 0;
      const stockMax = product?.stock_max ?? 0;

      data.forEach((d) => {
        if (!dateMap.has(d.date)) {
          const [year, month] = d.date.split("-");
          const date = new Date(parseInt(year), parseInt(month) - 1);
          dateMap.set(d.date, {
            month: d.date,
            monthLabel: format(date, "MMM yy", { locale: fr }),
          });
        }
        const entry = dateMap.get(d.date)!;
        entry[productId] = calculateStockScore(d.totalStock, stockMin, stockMax);
      });
    });

    return Array.from(dateMap.values()).sort((a, b) =>
      (a.month as string).localeCompare(b.month as string)
    );
  }, [hasProductFilter, selectedProductIds, productEvolutionQueries, products]);

  const scoreChartData = hasProductFilter ? productScoreData : globalScoreData;

  // ─── Flow bar chart data ──────────────────────────────────────────
  const flowChartData = useMemo(() => {
    return globalChartData.map((d) => {
      const [year, month] = d.date.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return {
        ...d,
        monthLabel: format(date, "MMM yy", { locale: fr }),
      };
    });
  }, [globalChartData]);

  // ─── Filter helpers ───────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return products;
    return products.filter((p) => p.category_id === selectedCategoryId);
  }, [products, selectedCategoryId]);

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= MAX_PRODUCTS) return prev;
      return [...prev, productId];
    });
  };

  const removeProduct = (productId: string) => {
    setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
  };

  const clearProducts = () => setSelectedProductIds([]);

  const getProductColor = (productId: string) => {
    const index = selectedProductIds.indexOf(productId);
    return index >= 0 ? PRODUCT_COLORS[index % PRODUCT_COLORS.length] : PRODUCT_COLORS[0];
  };

  // ─── Loading ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {hasProductFilter
            ? `${selectedProductIds.length} produit${selectedProductIds.length > 1 ? "s" : ""} selectionne${selectedProductIds.length > 1 ? "s" : ""}`
            : "Score de sante global"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedCategoryId || "all"}
            onValueChange={(val) => setSelectedCategoryId(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <Folder className="size-3.5 mr-1.5" />
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {categoriesData.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs justify-start min-w-[160px]"
              >
                <Package className="size-3.5 mr-1.5" />
                {hasProductFilter
                  ? `${selectedProductIds.length} produit${selectedProductIds.length > 1 ? "s" : ""}`
                  : "Selectionner produits"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Rechercher un produit..." />
                <CommandList>
                  <CommandEmpty>Aucun produit trouve</CommandEmpty>
                  <CommandGroup>
                    {filteredProducts.map((product) => {
                      const isSelected = selectedProductIds.includes(product.id);
                      const isDisabled =
                        !isSelected && selectedProductIds.length >= MAX_PRODUCTS;
                      return (
                        <CommandItem
                          key={product.id}
                          onSelect={() => toggleProduct(product.id)}
                          disabled={isDisabled}
                          className={cn(
                            "flex items-center gap-2",
                            isDisabled && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <Checkbox checked={isSelected} className="mr-1" />
                          {isSelected && (
                            <div
                              className="size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: getProductColor(product.id) }}
                            />
                          )}
                          <span className="truncate flex-1">{product.name}</span>
                          {product.sku && (
                            <span className="text-[10px] text-muted-foreground">
                              {product.sku}
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
                {hasProductFilter && (
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs h-7"
                      onClick={clearProducts}
                    >
                      Effacer la selection
                    </Button>
                  </div>
                )}
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Selected products badges */}
      {hasProductFilter && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProductIds.map((productId, index) => {
            const product = products.find((p) => p.id === productId);
            return (
              <Badge
                key={productId}
                variant="secondary"
                className="text-xs pl-2 pr-1 py-0.5 gap-1.5"
              >
                <div
                  className="size-2 rounded-full"
                  style={{
                    backgroundColor: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
                  }}
                />
                <span className="max-w-[120px] truncate">{product?.name}</span>
                <button
                  onClick={() => removeProduct(productId)}
                  className="ml-0.5 hover:bg-muted rounded p-0.5"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Score chart with loading overlay */}
      <div className="relative">
        {isLoadingProducts && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {scoreChartData.length > 0 ? (
          <ChartContainer
            className="h-[200px] lg:h-[250px] w-full"
            config={scoreChartConfig}
          >
            <AreaChart
              accessibilityLayer
              data={scoreChartData}
              margin={{ left: 12, right: 12, top: 5, bottom: 5 }}
            >
              <defs>
                {hasProductFilter ? (
                  selectedProductIds.map((productId, index) => (
                    <linearGradient
                      key={productId}
                      id={`fill-${productId}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={PRODUCT_COLORS[index % PRODUCT_COLORS.length]}
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="95%"
                        stopColor={PRODUCT_COLORS[index % PRODUCT_COLORS.length]}
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  ))
                ) : (
                  <linearGradient id="fillScore" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                )}
              </defs>

              {/* Background bands */}
              <ReferenceArea y1={70} y2={100} fill={ZONE_GREEN} fillOpacity={1} />
              <ReferenceArea y1={40} y2={70} fill={ZONE_ORANGE} fillOpacity={1} />
              <ReferenceArea y1={0} y2={40} fill={ZONE_RED} fillOpacity={1} />

              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                ticks={[0, 40, 70, 100]}
              />
              <ChartTooltip content={<ScoreTooltipContent />} />

              {hasProductFilter ? (
                selectedProductIds.map((productId, index) => (
                  <Area
                    key={productId}
                    dataKey={productId}
                    type="monotone"
                    fill={`url(#fill-${productId})`}
                    stroke={PRODUCT_COLORS[index % PRODUCT_COLORS.length]}
                    strokeWidth={2}
                  />
                ))
              ) : (
                <Area
                  dataKey="score"
                  type="monotone"
                  fill="url(#fillScore)"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                />
              )}

              {hasProductFilter && <ChartLegend content={<ChartLegendContent />} />}
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            {hasProductFilter
              ? "Selectionnez des produits pour voir leur score"
              : "Historique en cours de construction"}
          </div>
        )}
      </div>

      {/* Entries/Exits Bar Chart (global view only) */}
      {!hasProductFilter && flowChartData.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-3">Flux mensuels</p>
          <ChartContainer
            className="h-[120px] lg:h-[150px] w-full"
            config={flowChartConfig}
          >
            <BarChart
              accessibilityLayer
              data={flowChartData}
              margin={{ left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip cursor={false} content={<FlowTooltipContent />} />
              <Bar
                dataKey="entries"
                fill="hsl(160 84% 39%)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="exits"
                fill="hsl(350 89% 60%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
