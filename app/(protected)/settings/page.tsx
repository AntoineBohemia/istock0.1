import { generateMeta } from "@/lib/utils";
import { Settings } from "lucide-react";

export const metadata = generateMeta({
  title: "Configuration",
  description: "Paramètres de l'application",
  canonical: "/settings",
});

export default function SettingsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="rounded-full bg-muted p-6 mb-6">
        <Settings className="size-12 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold mb-2">Configuration</h1>
      <p className="text-muted-foreground max-w-md">
        Les paramètres de configuration seront disponibles prochainement.
      </p>
    </div>
  );
}
