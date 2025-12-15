import { EventInput } from "@fullcalendar/core";

export const eventColors: Record<string, string> = {
  blue: "text-xs bg-linear-to-r from-blue-500 to-purple-500 text-white dark:bg-blue-950 hover:bg-linear-to-r hover:opacity-80",
  red: "text-xs bg-linear-to-r from-red-500 to-yellow-500 text-white dark:bg-blue-950 hover:bg-linear-to-r hover:opacity-80",
  green:
    "text-xs bg-linear-to-r from-green-500 to-yellow-500 text-white dark:bg-blue-950 hover:bg-linear-to-r hover:opacity-80",
  purple:
    "text-xs bg-linear-to-r from-purple-500 to-pink-500 text-white dark:bg-blue-950 hover:bg-linear-to-r hover:opacity-80",
  orange:
    "text-xs bg-linear-to-r from-orange-500 to-red-500 text-white dark:bg-blue-950 hover:bg-linear-to-r hover:opacity-80",
  teal: "text-xs bg-linear-to-r from-teal-500 to-green-500 text-white dark:bg-blue-950 hover:bg-linear-to-r hover:opacity-80",
};

export const calendarEvents: EventInput[] = [
  {
    id: "1",
    title: "Chantier - Réparation plafond salle de bain",
    start: new Date(2025, 8, 2, 8, 30).toISOString(),
    end: new Date(2025, 8, 2, 12, 0).toISOString(),
    description: "Suite à un dégât des eaux chez M. Dupont",
    color: "blue",
  },
  {
    id: "2",
    title: "Chantier - Remplacement parquet",
    start: new Date(2025, 8, 4, 9, 0).toISOString(),
    end: new Date(2025, 8, 4, 17, 0).toISOString(),
    description: "Dégât des eaux - Appartement rue Victor Hugo",
    color: "red",
  },
  {
    id: "3",
    title: "Chantier - Séchage & décontamination murs",
    start: new Date(2025, 8, 6, 10, 0).toISOString(),
    end: new Date(2025, 8, 6, 15, 30).toISOString(),
    description: "Infiltration depuis l'étage supérieur",
    color: "green",
  },
  {
    id: "4",
    title: "Chantier - Inspection assurance",
    start: new Date(2025, 8, 8, 14, 0).toISOString(),
    end: new Date(2025, 8, 8, 15, 0).toISOString(),
    description: "Constat des dégâts par expert",
    color: "orange",
  },
  {
    id: "5",
    title: "Chantier - Peinture après sinistre",
    start: new Date(2025, 8, 10, 13, 0).toISOString(),
    end: new Date(2025, 8, 10, 16, 0).toISOString(),
    description: "Remise en état post intervention",
    color: "purple",
  },
];
