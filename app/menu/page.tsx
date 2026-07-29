import type { Metadata } from "next";
import { MenuStudio } from "@/components/menu/menu-studio";

export const metadata: Metadata = {
  title: "Menu",
  description: "Write the wedding dinner course by course, mark which guest allergies each course clashes with, and print menu cards."
};

export default function MenuPage() {
  return <MenuStudio />;
}
