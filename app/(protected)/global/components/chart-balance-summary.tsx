"use client";

import { useState, useMemo } from "react";
import { CartesianGrid, XAxis, YAxis, Area, AreaChart, Bar, BarChart } from "recharts";
import { Loader2, ChevronDown, ChevronUp, BarChart3, Package, Folder, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  getProductStockEvolution,
  StockEvolutionData,
} from "@/lib/supabase/queries/dashboard";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useDashboardStats, useGlobalStockEvolution } from "@/hooks/queries";
import { useCategories } from "@/hooks/queries";
import { useProducts } from "@/hooks/queries";
import { useQueries } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
}

// Palette de couleurs pour les produits
const PRODUCT_COLORS = [
  "hsl(220, 90%, 55%)",   // Bleu
  "hsl(142, 76%, 36%)",   // Vert
  "hsl(280, 70%, 50%)",   // Violet
  "hsl(32, 95%, 44%)",    // Orange
  "hsl(184, 92%, 33%)",   // Cyan
  "hsl(340, 80%, 55%)",   // Rose
];

const MAX_PRODUCTS = 6;

// Type for multi-product chart data
interface MultiProductChartData {
  date: string;
  monthLabel: string;
  [productId: string]: number | string;
}

export function BalanceSummeryChart() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [isExpanded, setIsExpanded] = useState(false);

  // React Query hooks for data
  const { data: stats = null, isLoading: isStatsLoading } = useDashboardStats(currentOrganization?.id);
  const { data: globalChartData = [], isLoading: isEvolutionLoading } = useGlobalStockEvolution(currentOrganization?.id, 6);
  const { data: categoriesData = [] } = useCategories(currentOrganization?.id);
  const { data: productsResult } = useProducts({ organizationId: currentOrganization?.id, pageSize: 1000 });

  const categories = categoriesData;
  const products: Product[] = (productsResult?.products || []).map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category_id: p.category_id,
  }));

  const isLoading = isStatsLoading || isEvolutionLoading;

  // Selection state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  // Fetch per-product stock evolution via React Query (replaces raw useEffect)
  const productEvolutionQueries = useQueries({
    queries: selectedProductIds.map((productId) => ({
      queryKey: queryKeys.dashboard.productEvolution(productId, 6),
      queryFn: () => getProductStockEvolution(productId, 6),
      enabled: !!productId && !isLoading,
      staleTime: STALE_TIME.SLOW,
    })),
  });

  const isLoadingChart = productEvolutionQueries.some((q) => q.isLoading);

  // Build productChartData from React Query results
  const productChartData = useMemo(() => {
    const data: Record<string, StockEvolutionData[]> = {};
    selectedProductIds.forEach((productId, index) => {
      const queryResult = productEvolutionQueries[index];
      if (queryResult?.data) {
        data[productId] = queryResult.data;
      }
    });
    return data;
  }, [selectedProductIds, productEvolutionQueries]);

  // Filter products by category
  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return products;
    return products.filter(p => p.category_id === selectedCategoryId);
  }, [products, selectedCategoryId]);

  // Build dynamic chart config based on selected products
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      totalStock: {
        label: "Stock global",
        color: "hsl(var(--chart-1))",
      },
      entries: {
        label: "Entrées",
        color: "hsl(160 84% 39%)",
      },
      exits: {
        label: "Sorties",
        color: "hsl(350 89% 60%)",
      },
    };

    selectedProductIds.forEach((productId, index) => {
      const product = products.find(p => p.id === productId);
      if (product) {
        config[productId] = {
          label: product.name,
          color: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
        };
      }
    });

    return config;
  }, [selectedProductIds, products]);

  // Merge product data for chart
  const mergedChartData = useMemo((): MultiProductChartData[] => {
    // If no products selected, show global data
    if (selectedProductIds.length === 0) {
      return globalChartData.map(d => {
        const [year, month] = d.date.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          date: d.date,
          monthLabel: format(date, "MMM yy", { locale: fr }),
          totalStock: d.totalStock,
        };
      });
    }

    // Merge data from selected products
    const dateMap = new Map<string, MultiProductChartData>();

    selectedProductIds.forEach(productId => {
      const data = productChartData[productId] || [];
      data.forEach(d => {
        if (!dateMap.has(d.date)) {
          const [year, month] = d.date.split("-");
          const date = new Date(parseInt(year), parseInt(month) - 1);
          dateMap.set(d.date, {
            date: d.date,
            monthLabel: format(date, "MMM yy", { locale: fr }),
          });
        }
        const entry = dateMap.get(d.date)!;
        entry[productId] = d.totalStock;
      });
    });

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedProductIds, productChartData, globalChartData]);

  // Handle product selection
  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      }
      if (prev.length >= MAX_PRODUCTS) {
        return prev;
      }
      return [...prev, productId];
    });
  };

  const removeProduct = (productId: string) => {
    setSelectedProductIds(prev => prev.filter(id => id !== productId));
  };

  const clearProducts = () => {
    setSelectedProductIds([]);
  };

  // Get color for a product
  const getProductColor = (productId: string) => {
    const index = selectedProductIds.indexOf(productId);
    return index >= 0 ? PRODUCT_COLORS[index % PRODUCT_COLORS.length] : PRODUCT_COLORS[0];
  };

  if (isLoading || isOrgLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base lg:text-lg">Evolution du stock</CardTitle>
        </CardHeader>
        <CardContent className="flex h-32 lg:h-[300px] items-center justify-center">
          <Loader2 className="size-6 lg:size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Shared chart content
  const ChartContent = () => (
    <div className="space-y-6 relative">
      {isLoadingChart && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-gradient-to-br from-background to-muted/30 p-3 lg:p-4 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap truncate">
            Stock actuel
          </p>
          <p className="mt-1 text-xl lg:text-2xl font-bold tabular-nums whitespace-nowrap">
            {stats?.totalStock.toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-background to-muted/30 p-3 lg:p-4 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap truncate">
            Valeur totale
          </p>
          <p className="mt-1 text-xl lg:text-2xl font-bold tabular-nums whitespace-nowrap">
            {stats?.totalValue.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-background to-emerald-500/10 p-3 lg:p-4 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap truncate">
            Entrées (mois)
          </p>
          <p className="mt-1 text-xl lg:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
            +{stats?.monthlyEntries.toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-background to-rose-500/10 p-3 lg:p-4 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap truncate">
            Sorties (mois)
          </p>
          <p className="mt-1 text-xl lg:text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
            -{stats?.monthlyExits.toLocaleString("fr-FR")}
          </p>
        </div>
      </div>

      {/* Stock Evolution Area Chart */}
      {mergedChartData.length > 0 ? (
        <ChartContainer className="h-[200px] lg:h-[250px] w-full" config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={mergedChartData}
            margin={{ left: 12, right: 12 }}
          >
            <defs>
              {selectedProductIds.length === 0 ? (
                <linearGradient id="fillStock" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                </linearGradient>
              ) : (
                selectedProductIds.map((productId, index) => (
                  <linearGradient key={productId} id={`fill-${productId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PRODUCT_COLORS[index % PRODUCT_COLORS.length]} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={PRODUCT_COLORS[index % PRODUCT_COLORS.length]} stopOpacity={0.05} />
                  </linearGradient>
                ))
              )}
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="monthLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.toLocaleString("fr-FR")}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            {selectedProductIds.length === 0 ? (
              <Area
                dataKey="totalStock"
                type="monotone"
                fill="url(#fillStock)"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
              />
            ) : (
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
            )}
            {selectedProductIds.length > 0 && (
              <ChartLegend content={<ChartLegendContent />} />
            )}
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="flex h-[200px] items-center justify-center text-muted-foreground">
          Aucune donnée disponible
        </div>
      )}

      {/* Entries/Exits Bar Chart (only show for global view) */}
      {selectedProductIds.length === 0 && mergedChartData.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-3">Flux mensuels</p>
          <ChartContainer className="h-[120px] lg:h-[150px] w-full" config={chartConfig}>
            <BarChart
              accessibilityLayer
              data={globalChartData.map(d => {
                const [year, month] = d.date.split("-");
                const date = new Date(parseInt(year), parseInt(month) - 1);
                return {
                  ...d,
                  monthLabel: format(date, "MMM yy", { locale: fr }),
                };
              })}
              margin={{ left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
              />
              <Bar dataKey="entries" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="exits" fill="hsl(350 89% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );

  return (
    <Card className="h-full">
      {/* Mobile: Collapsible view */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="lg:hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="size-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Graphiques</CardTitle>
                  <CardDescription className="text-xs">
                    {stats?.totalStock.toLocaleString("fr-FR")} unités
                    {selectedProductIds.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                        {selectedProductIds.length} produit{selectedProductIds.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
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
            <ChartContent />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Desktop: Full view */}
      <div className="hidden lg:block">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <span className="text-3xl font-bold tabular-nums">
                  {stats?.totalStock.toLocaleString("fr-FR")}
                </span>
              </CardTitle>
              <CardDescription>
                {selectedProductIds.length === 0
                  ? "Vue globale de tous les produits"
                  : `${selectedProductIds.length} produit${selectedProductIds.length > 1 ? "s" : ""} sélectionné${selectedProductIds.length > 1 ? "s" : ""}`
                }
              </CardDescription>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <Select
                value={selectedCategoryId || "all"}
                onValueChange={(val) => setSelectedCategoryId(val === "all" ? null : val)}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <Folder className="size-3.5 mr-1.5" />
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Product Multi-Select */}
              <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs justify-start min-w-[160px]"
                  >
                    <Package className="size-3.5 mr-1.5" />
                    {selectedProductIds.length === 0 ? (
                      "Sélectionner produits"
                    ) : (
                      `${selectedProductIds.length} produit${selectedProductIds.length > 1 ? "s" : ""}`
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Rechercher un produit..." />
                    <CommandList>
                      <CommandEmpty>Aucun produit trouvé</CommandEmpty>
                      <CommandGroup>
                        {filteredProducts.map((product) => {
                          const isSelected = selectedProductIds.includes(product.id);
                          const isDisabled = !isSelected && selectedProductIds.length >= MAX_PRODUCTS;
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
                              <Checkbox
                                checked={isSelected}
                                className="mr-1"
                              />
                              {isSelected && (
                                <div
                                  className="size-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: getProductColor(product.id) }}
                                />
                              )}
                              <span className="truncate flex-1">{product.name}</span>
                              {product.sku && (
                                <span className="text-[10px] text-muted-foreground">{product.sku}</span>
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                    {selectedProductIds.length > 0 && (
                      <div className="border-t p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs h-7"
                          onClick={clearProducts}
                        >
                          Effacer la sélection
                        </Button>
                      </div>
                    )}
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Selected products badges */}
          {selectedProductIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 py-4">
              {selectedProductIds.map((productId, index) => {
                const product = products.find(p => p.id === productId);
                return (
                  <Badge
                    key={productId}
                    variant="secondary"
                    className="text-xs pl-2 pr-1 py-0.5 gap-1.5"
                  >
                    <div
                      className="size-2 rounded-full"
                      style={{ backgroundColor: PRODUCT_COLORS[index % PRODUCT_COLORS.length] }}
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
        </CardHeader>
        <CardContent>
          <ChartContent />
        </CardContent>
      </div>
    </Card>
  );
}
