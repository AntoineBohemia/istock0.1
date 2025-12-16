"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Area, AreaChart, Bar, BarChart } from "recharts";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
  CardAction,
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
import { ExportButton } from "@/components/CardActionMenus";
import {
  getDashboardStats,
  getGlobalStockEvolution,
  getProductStockEvolution,
  StockEvolutionData,
  DashboardStats,
} from "@/lib/supabase/queries/dashboard";
import { createClient } from "@/lib/supabase/client";
import { Category } from "@/lib/supabase/queries/categories";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
}

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

export function BalanceSummeryChart() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<StockEvolutionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  // Filtres
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");

  // Charger les données initiales
  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();

        const [statsData, evolutionData, categoriesData, productsData] = await Promise.all([
          getDashboardStats(),
          getGlobalStockEvolution(6),
          supabase.from("categories").select("*").order("name"),
          supabase.from("products").select("id, name, sku, category_id").order("name"),
        ]);

        setStats(statsData);
        setChartData(evolutionData);
        setCategories(categoriesData.data || []);
        setProducts(productsData.data || []);
        setFilteredProducts(productsData.data || []);
      } catch (error) {
        console.error("Error loading chart data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtrer les produits quand la catégorie change
  useEffect(() => {
    if (selectedCategory === "all") {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter((p) => p.category_id === selectedCategory));
    }
    // Reset product selection when category changes
    setSelectedProduct("all");
  }, [selectedCategory, products]);

  // Recharger les données du graphique quand le produit change
  useEffect(() => {
    async function loadChartData() {
      if (isLoading) return;

      setIsLoadingChart(true);
      try {
        let evolutionData: StockEvolutionData[];

        if (selectedProduct === "all") {
          evolutionData = await getGlobalStockEvolution(6);
        } else {
          evolutionData = await getProductStockEvolution(selectedProduct, 6);
        }

        setChartData(evolutionData);
      } catch (error) {
        console.error("Error loading chart data:", error);
      } finally {
        setIsLoadingChart(false);
      }
    }
    loadChartData();
  }, [selectedProduct, isLoading]);

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
  };

  const handleProductChange = (value: string) => {
    setSelectedProduct(value);
  };

  // Formatter les dates pour l'affichage
  const formattedChartData = chartData.map((d) => {
    const [year, month] = d.date.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return {
      ...d,
      monthLabel: format(date, "MMM yy", { locale: fr }),
    };
  });

  if (isLoading) {
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

  const selectedProductName = selectedProduct === "all"
    ? "Stock global"
    : products.find((p) => p.id === selectedProduct)?.name || "Produit";

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Evolution du stock</CardTitle>
            <CardDescription>
              {selectedProduct === "all" ? "Vue globale de tous les produits" : selectedProductName}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="category-select" className="text-xs text-muted-foreground whitespace-nowrap">
                Catégorie
              </Label>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger id="category-select" className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Toutes" />
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
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="product-select" className="text-xs text-muted-foreground whitespace-nowrap">
                Produit
              </Label>
              <Select value={selectedProduct} onValueChange={handleProductChange}>
                <SelectTrigger id="product-select" className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les produits</SelectItem>
                  {filteredProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ExportButton />
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative">
        {selectedProduct === "all" && (
          <div className="mb-8 grid gap-4 text-sm md:grid-cols-2 lg:max-w-(--breakpoint-sm) lg:grid-cols-4">
            <div className="bg-muted space-y-2 rounded-md border p-4">
              <div className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: colorStock }}
                ></span>
                <span>Stock actuel</span>
              </div>
              <div className="text-xl font-semibold">
                {stats?.totalStock.toLocaleString("fr-FR")}
              </div>
            </div>
            <div className="bg-muted space-y-2 rounded-md border p-4">
              <div className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full bg-blue-500"
                ></span>
                <span>Valeur totale</span>
              </div>
              <div className="text-xl font-semibold">
                {stats?.totalValue.toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
            <div className="bg-muted space-y-2 rounded-md border p-4">
              <div className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: colorEntries }}
                ></span>
                <span>Entrées (mois)</span>
              </div>
              <div className="text-xl font-semibold text-green-600">
                +{stats?.monthlyEntries.toLocaleString("fr-FR")}
              </div>
            </div>
            <div className="bg-muted space-y-2 rounded-md border p-4">
              <div className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: colorExits }}
                ></span>
                <span>Sorties (mois)</span>
              </div>
              <div className="text-xl font-semibold text-red-600">
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
          <ChartContainer className="w-full lg:h-[300px]" config={chartConfig}>
            <AreaChart
              accessibilityLayer
              data={formattedChartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
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
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Area
                dataKey="totalStock"
                type="monotone"
                fill={colorStock}
                fillOpacity={0.3}
                stroke={colorStock}
                strokeWidth={2}
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
            <p className="mb-4 text-sm font-medium">Flux mensuels</p>
            <ChartContainer className="w-full h-[150px]" config={chartConfig}>
              <BarChart
                accessibilityLayer
                data={formattedChartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
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
                <Bar
                  dataKey="entries"
                  fill={colorEntries}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="exits"
                  fill={colorExits}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
