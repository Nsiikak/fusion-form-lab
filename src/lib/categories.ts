import { Building2, Cake, Camera, ClipboardList, Gift, Lightbulb, Music, Palette, Scissors, ShieldCheck, Sparkles, Truck, Utensils, Wine, Armchair, Store } from "lucide-react";
import type { ElementType } from "react";

/** Every vendor category, in one place. Values match the backend VendorCategory enum. */
export const CATEGORIES: { value: string; label: string; icon: ElementType; hint: string }[] = [
  { value: "catering", label: "Catering", icon: Utensils, hint: "Food, small chops, native dishes" },
  { value: "cakes", label: "Cakes & pastries", icon: Cake, hint: "Wedding and celebration cakes, desserts" },
  { value: "drinks", label: "Drinks & bar", icon: Wine, hint: "Cocktails, mocktails, bar service" },
  { value: "decoration", label: "Décor & styling", icon: Palette, hint: "Hall décor, flowers, backdrops" },
  { value: "venue", label: "Venues", icon: Building2, hint: "Halls, gardens, lounges" },
  { value: "photography", label: "Photo & video", icon: Camera, hint: "Photographers, videographers, drones" },
  { value: "entertainment", label: "DJs, MCs & bands", icon: Music, hint: "Music and hosting" },
  { value: "sound_lighting", label: "Sound, lighting & screens", icon: Lightbulb, hint: "PA, stage lights, LED screens" },
  { value: "beauty", label: "Make-up, gele & hair", icon: Sparkles, hint: "Make-up artists, gele tiers, stylists" },
  { value: "fashion", label: "Tailoring & aso-ebi", icon: Scissors, hint: "Outfits, aso-ebi, alterations" },
  { value: "planning", label: "Planners & coordinators", icon: ClipboardList, hint: "Full planning or on-the-day coordination" },
  { value: "rentals", label: "Rentals", icon: Armchair, hint: "Chairs, tables, canopies, cutlery" },
  { value: "logistics", label: "Transport & logistics", icon: Truck, hint: "Cars, buses, delivery" },
  { value: "souvenirs", label: "Souvenirs & printing", icon: Gift, hint: "Souvenirs, IV cards, programmes" },
  { value: "ushers_security", label: "Ushers & security", icon: ShieldCheck, hint: "Ushers, hostesses, guards" },
];

export const categoryLabel = (value?: string | null) => CATEGORIES.find((c) => c.value === value)?.label ?? (value || "");
export const categoryIcon = (value?: string | null): ElementType => CATEGORIES.find((c) => c.value === value)?.icon ?? Store;
export const categoryValue = (label?: string | null) => CATEGORIES.find((c) => c.label === label)?.value ?? null;

/** Nigerian states + FCT, for event location and vendor delivery settings. */
export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi",
  "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];
