"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboardingStore, CategoryData } from "../store";
import { FolderTree, Loader2, Plus, X, Info, Check } from "lucide-react";
import { createCategory } from "@/lib/supabase/queries/categories";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SUGGESTED_CATEGORIES = [
  // Peintures
  { name: "Peintures interieures", emoji: "🏠" },
  { name: "Peintures exterieures", emoji: "🏡" },
  { name: "Peintures bois", emoji: "🪵" },
  { name: "Peintures metal", emoji: "🔩" },
  { name: "Peintures sol", emoji: "🏗️" },
  { name: "Laques", emoji: "✨" },
  // Revetements
  { name: "Enduits", emoji: "🧱" },
  { name: "Crepi", emoji: "🏢" },
  { name: "Sous-couches", emoji: "🖌️" },
  { name: "Primers", emoji: "🎯" },
  // Vernis et lasures
  { name: "Vernis", emoji: "💎" },
  { name: "Lasures", emoji: "🌲" },
  { name: "Huiles", emoji: "🫒" },
  // Preparation
  { name: "Diluants", emoji: "💧" },
  { name: "Decapants", emoji: "🧴" },
  { name: "Nettoyants", emoji: "🧹" },
  { name: "Mastics", emoji: "🔧" },
  // Outillage
  { name: "Pinceaux", emoji: "🖌️" },
  { name: "Rouleaux", emoji: "🎨" },
  { name: "Pistolets", emoji: "🔫" },
  { name: "Baches et adhesifs", emoji: "📦" },
  // Accessoires
  { name: "EPI", emoji: "🦺" },
  { name: "Echelles", emoji: "🪜" },
  { name: "Abrasifs", emoji: "📄" },
];

export function CategoriesStep() {
  const {
    data,
    addCategory,
    removeCategory,
    setCategoryId,
    nextStep,
    prevStep,
    skipStep,
    markStepCompleted,
    isLoading,
    setLoading,
  } = useOnboardingStore();

  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;

    // Check if category already exists
    if (data.categories.some((c) => c.name.toLowerCase() === newCategoryName.toLowerCase())) {
      toast.error("Cette categorie existe deja");
      return;
    }

    addCategory({ name: newCategoryName.trim() });
    setNewCategoryName("");
  };

  const handleAddSuggested = (name: string) => {
    if (data.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Cette categorie existe deja");
      return;
    }
    addCategory({ name });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCategory();
    }
  };

  const handleSaveAll = async () => {
    if (data.categories.length === 0) {
      toast.error("Ajoutez au moins une categorie");
      return;
    }

    if (!data.createdOrganizationId) {
      toast.error("Organisation non trouvee");
      return;
    }

    setLoading(true);

    try {
      // Save all categories that don't have an ID yet
      for (let i = 0; i < data.categories.length; i++) {
        const cat = data.categories[i];
        if (!cat.id) {
          setSavingIndex(i);
          const created = await createCategory(
            data.createdOrganizationId,
            cat.name,
            cat.parentId
          );
          setCategoryId(i, created.id);
        }
      }

      markStepCompleted("categories");
      toast.success(`${data.categories.length} categorie(s) creee(s) !`);
      nextStep();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur lors de la creation";
      toast.error(message);
    } finally {
      setLoading(false);
      setSavingIndex(null);
    }
  };

  const handleSkip = () => {
    skipStep();
    toast.info("Vous pourrez ajouter des categories plus tard");
  };

  const isSuggestionAdded = (name: string) =>
    data.categories.some((c) => c.name.toLowerCase() === name.toLowerCase());

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <div className="bg-primary flex size-10 items-center justify-center rounded-full">
          <FolderTree className="text-primary-foreground size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Creez vos categories</h1>
          <p className="text-muted-foreground">
            Organisez vos produits par categories pour les retrouver facilement
          </p>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 flex gap-3">
        <Info className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">Suggestions rapides</p>
          <p className="text-muted-foreground">
            Cliquez sur une suggestion ou ajoutez vos propres categories
          </p>
        </div>
      </div>

      {/* Suggested categories */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_CATEGORIES.map((cat) => (
          <Button
            key={cat.name}
            variant={isSuggestionAdded(cat.name) ? "secondary" : "outline"}
            size="sm"
            onClick={() => handleAddSuggested(cat.name)}
            disabled={isSuggestionAdded(cat.name)}
            className="gap-1.5"
          >
            <span>{cat.emoji}</span>
            <span>{cat.name}</span>
            {isSuggestionAdded(cat.name) && <Check className="size-3.5 ml-1" />}
          </Button>
        ))}
      </div>

      {/* Custom category input */}
      <div className="space-y-2">
        <Label>Ajouter une categorie personnalisee</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Nom de la categorie..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1"
          />
          <Button
            onClick={handleAddCategory}
            disabled={!newCategoryName.trim()}
            size="icon"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Added categories list */}
      {data.categories.length > 0 && (
        <div className="space-y-3">
          <Label>Categories ajoutees ({data.categories.length})</Label>
          <div className="space-y-2">
            {data.categories.map((category, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border bg-background",
                  category.id && "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                )}
              >
                <div className="flex items-center gap-3">
                  {savingIndex === index ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : category.id ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <FolderTree className="size-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">{category.name}</span>
                </div>
                {!category.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCategory(index)}
                    className="size-8 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Retour
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleSkip}>
            Passer cette etape
          </Button>
          <Button
            size="lg"
            onClick={handleSaveAll}
            disabled={data.categories.length === 0 || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Enregistrer ({data.categories.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
