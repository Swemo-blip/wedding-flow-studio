export type AppNavigationGroup = "Core" | "Details";

export type AppNavigationItem = {
  group: AppNavigationGroup;
  href: string;
  label: string;
  primaryActionHref: string;
  primaryActionLabel: string;
  shortDescription: string;
  signal: string;
  summary: string;
};

export const navigationItems: AppNavigationItem[] = [
  {
    group: "Core",
    href: "/",
    label: "Studio",
    primaryActionHref: "/preview",
    primaryActionLabel: "Preview Wedding Day",
    shortDescription: "Next move",
    signal: "3D planning canvas",
    summary: "Adjust the visual wedding-day digital twin and keep one best next decision in view."
  },
  {
    group: "Core",
    href: "/preview",
    label: "Preview",
    primaryActionHref: "/director",
    primaryActionLabel: "Open Director Mode",
    shortDescription: "See the day",
    signal: "Day sequence",
    summary: "Walk the wedding moment by moment with locations, people, cues, and risks connected."
  },
  {
    group: "Core",
    href: "/day-flow",
    label: "Day Flow",
    primaryActionHref: "/exports",
    primaryActionLabel: "Prepare Run of Show",
    shortDescription: "Repair timing",
    signal: "Timeline repair",
    summary: "Tune the run of show, resolve timing risk, and protect handoffs before the day starts."
  },
  {
    group: "Core",
    href: "/director",
    label: "Director",
    primaryActionHref: "/exports",
    primaryActionLabel: "Export Role Briefs",
    shortDescription: "Role boards",
    signal: "Role-ready view",
    summary: "Give each role a focused board with only the items, cues, risks, and contacts they need."
  },
  {
    group: "Core",
    href: "/exports",
    label: "Exports",
    primaryActionHref: "/preview",
    primaryActionLabel: "Preview Again",
    shortDescription: "Briefs",
    signal: "Brief builder",
    summary: "Turn the digital twin into clear run-of-show, cue sheet, and vendor brief previews."
  },
  {
    group: "Details",
    href: "/ceremony",
    label: "Ceremony",
    primaryActionHref: "/",
    primaryActionLabel: "Open 3D Studio",
    shortDescription: "Chapel layout",
    signal: "Ceremony plan",
    summary: "Review aisle, rows, family seating, music cues, photographer positions, and ceremony flow."
  },
  {
    group: "Details",
    href: "/reception",
    label: "Reception",
    primaryActionHref: "/exports",
    primaryActionLabel: "Export Seating Plan",
    shortDescription: "Guest journey",
    signal: "Seating logic",
    summary: "Connect tables, guest notes, meal needs, accessibility, service paths, and room flow."
  },
  {
    group: "Details",
    href: "/speeches",
    label: "Speeches",
    primaryActionHref: "/director",
    primaryActionLabel: "Brief Toastmaster",
    shortDescription: "Program",
    signal: "Secret Layers",
    summary: "Coordinate speeches, surprise items, technical needs, intro people, and reception timing."
  },
  {
    group: "Details",
    href: "/music",
    label: "Music",
    primaryActionHref: "/exports",
    primaryActionLabel: "Export Cue Sheet",
    shortDescription: "Cue sheet",
    signal: "Cue control",
    summary: "Confirm songs, start cues, responsible people, backup plans, and timeline-linked music moments."
  },
  {
    group: "Details",
    href: "/vendors",
    label: "Sourcing",
    primaryActionHref: "/director",
    primaryActionLabel: "Review Vendor Roles",
    shortDescription: "Vendor decisions",
    signal: "Vendor fit",
    summary: "Source, shortlist, compare, and connect real-world services to the wedding-day plan."
  },
  {
    group: "Details",
    href: "/intake",
    label: "Intake",
    primaryActionHref: "/",
    primaryActionLabel: "Open Studio",
    shortDescription: "Create project",
    signal: "Project composer",
    summary: "Create the first digital twin from venues, date, guest count, style, team, and priorities."
  }
];

const studioWorkspaceNavigationItem: AppNavigationItem = {
  group: "Core",
  href: "/studio",
  label: "Workspace",
  primaryActionHref: "/day-flow",
  primaryActionLabel: "Repair Active Moment",
  shortDescription: "Moment cockpit",
  signal: "Studio workspace",
  summary: "Inspect the active wedding moment, readiness, role handoff, and one best production decision."
};

export function getNavigationItemForPath(pathname: string) {
  if (pathname.startsWith("/studio")) {
    return studioWorkspaceNavigationItem;
  }

  return (
    navigationItems.find((item) => (item.href === "/" ? pathname === "/" || pathname.startsWith("/studio") : pathname.startsWith(item.href))) ??
    navigationItems[0]
  );
}
