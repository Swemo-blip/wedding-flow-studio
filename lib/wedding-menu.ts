import type { MenuCourse, MenuCourseKind } from "@/lib/wedding-types";

// Course order is the order they reach the table, which is also the order they
// print on a menu card. Kept here rather than inline so the editor, the card and
// the store validator can never disagree about it.
export const MENU_COURSE_KINDS: MenuCourseKind[] = ["canape", "starter", "main", "dessert", "late", "drink"];

export const menuCourseLabels: Record<MenuCourseKind, string> = {
  canape: "Canapés",
  dessert: "Dessert",
  drink: "Drinks",
  late: "Late night",
  main: "Main course",
  starter: "Starter"
};

export function sortMenuCourses(courses: MenuCourse[]) {
  return [...courses].sort((a, b) => MENU_COURSE_KINDS.indexOf(a.kind) - MENU_COURSE_KINDS.indexOf(b.kind));
}

// Every allergy the couple actually recorded on their guest list, de-duplicated
// and sorted — the only allowed source for a course's conflict list. Nothing is
// inferred from a dish name.
export function collectGuestAllergies(guests: { allergies: string[] }[]) {
  const seen = new Set<string>();
  guests.forEach((guest) => {
    guest.allergies.forEach((allergy) => {
      const trimmed = allergy.trim();
      if (trimmed) {
        seen.add(trimmed);
      }
    });
  });
  return [...seen].sort((a, b) => a.localeCompare(b));
}

// Guests whose recorded allergies collide with a course, so the couple can see
// exactly who needs the alternative rather than a count.
export function guestsAffectedBy(course: MenuCourse, guests: { id: string; name: string; allergies: string[] }[]) {
  if (course.conflictsWith.length === 0) {
    return [];
  }
  const conflicts = course.conflictsWith.map((entry) => entry.toLowerCase());
  return guests.filter((guest) => guest.allergies.some((allergy) => conflicts.includes(allergy.trim().toLowerCase())));
}
