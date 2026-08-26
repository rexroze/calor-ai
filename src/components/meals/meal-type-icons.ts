import {
  CookieIcon,
  CroissantIcon,
  SandwichIcon,
  UtensilsIcon,
  type LucideIcon,
} from "lucide-react";
import type { MealType } from "@/lib/contracts";

/** One icon per meal type, used identically on Today rows and detail screens. */
export const MEAL_TYPE_ICONS: Record<MealType, LucideIcon> = {
  breakfast: CroissantIcon,
  lunch: SandwichIcon,
  dinner: UtensilsIcon,
  snack: CookieIcon,
};
