"use client";

import { useState, useMemo } from "react";
import { icons } from "lucide-react";
import { Search, X } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;
const iconMap = icons as Record<string, IconComponent>;

interface IconPickerValue {
  name: string;
  color: string;
}

interface IconPickerProps {
  value: IconPickerValue | null;
  onChange: (value: IconPickerValue | null) => void;
}

const BTP_ICONS: { category: string; icons: string[] }[] = [
  {
    category: "Matériaux",
    icons: [
      "Brick", "Box", "Boxes", "Package", "PackageOpen",
      "Cylinder", "Cuboid", "Pipette", "Droplets", "Paintbrush",
      "PaintBucket",
    ],
  },
  {
    category: "Outils",
    icons: [
      "Wrench", "Hammer", "Drill", "Scissors", "Ruler",
      "Pen", "PenTool", "Cog", "Settings", "SlidersHorizontal",
      "Axe",
    ],
  },
  {
    category: "Construction",
    icons: [
      "Building", "Building2", "House", "Warehouse", "Factory",
      "Landmark", "Castle", "HardHat", "Fence", "Construction",
    ],
  },
  {
    category: "Électricité / Plomberie",
    icons: [
      "Zap", "Plug", "Cable", "Lightbulb", "Power",
      "BatteryFull", "Waves", "Droplet", "ShowerHead",
      "Thermometer",
    ],
  },
  {
    category: "Logistique",
    icons: [
      "Truck", "MapPin", "Navigation", "Route", "Container",
      "Weight", "Scale", "ArrowDownUp", "PackageCheck", "ClipboardList",
    ],
  },
  {
    category: "Sécurité",
    icons: [
      "Shield", "ShieldCheck", "HardHat", "Eye", "AlertTriangle",
      "Lock", "Flame", "HeartPulse", "Siren", "BadgeCheck",
    ],
  },
];

// Filter out icons that don't exist in the current lucide version
const VALID_BTP_ICONS = BTP_ICONS.map((cat) => ({
  ...cat,
  icons: cat.icons.filter((name) => iconMap[name]),
})).filter((cat) => cat.icons.length > 0);

const ALL_ICON_NAMES = VALID_BTP_ICONS.flatMap((c) => c.icons);
const UNIQUE_ICON_NAMES = [...new Set(ALL_ICON_NAMES)];

const COLOR_PALETTE = [
  { name: "Ardoise", value: "#475569" },
  { name: "Rouge", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Ambre", value: "#d97706" },
  { name: "Vert", value: "#16a34a" },
  { name: "Cyan", value: "#0891b2" },
  { name: "Bleu", value: "#2563eb" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Rose", value: "#db2777" },
  { name: "Neutre", value: "#737373" },
];

const DEFAULT_COLOR = COLOR_PALETTE[0].value;

export default function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedColor, setSelectedColor] = useState(value?.color ?? DEFAULT_COLOR);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return VALID_BTP_ICONS;
    const q = search.toLowerCase();
    return VALID_BTP_ICONS.map((cat) => ({
      ...cat,
      icons: cat.icons.filter((name) => name.toLowerCase().includes(q)),
    })).filter((cat) => cat.icons.length > 0);
  }, [search]);

  const handleSelectIcon = (iconName: string) => {
    onChange({ name: iconName, color: selectedColor });
    setOpen(false);
    setSearch("");
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    if (value) {
      onChange({ ...value, color });
    }
  };

  const SelectedIcon = value ? iconMap[value.name] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-20 w-20 p-0"
            >
              {SelectedIcon ? (
                <SelectedIcon className="size-10" style={{ color: value?.color }} />
              ) : (
                <span className="text-xs text-muted-foreground">Choisir</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une icône..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <ScrollArea className="h-64 px-3">
              {filteredCategories.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucune icône trouvée
                </p>
              ) : (
                filteredCategories.map((cat) => (
                  <div key={cat.category} className="mb-3">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {cat.category}
                    </p>
                    <div className="grid grid-cols-7 gap-1">
                      {cat.icons.map((name) => {
                        const Icon = iconMap[name];
                        if (!Icon) return null;
                        const isSelected = value?.name === name;
                        return (
                          <button
                            key={name}
                            type="button"
                            className={`flex size-9 items-center justify-center rounded-md border transition-colors hover:bg-accent ${
                              isSelected ? "border-primary bg-accent" : "border-transparent"
                            }`}
                            onClick={() => handleSelectIcon(name)}
                            title={name}
                          >
                            <Icon
                              className="size-5"
                              style={{ color: selectedColor }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {value && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{value.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-fit px-2 text-xs text-muted-foreground"
              onClick={() => onChange(null)}
            >
              <X className="mr-1 size-3" />
              Retirer
            </Button>
          </div>
        )}
      </div>

      {/* Color palette */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Couleur</p>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${
                selectedColor === c.value ? "border-foreground scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c.value }}
              onClick={() => handleColorChange(c.value)}
              title={c.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
