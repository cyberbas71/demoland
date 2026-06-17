// Central config for the three demo tools surfaced on the hub.
//
// This is a single combined app: each tool's demo is mounted under its own
// path (`/tuesday`, `/systemready`, `/docktrail`) and backed by its own schema
// in the shared `Demoland` Supabase project. The landing page links to these
// internal routes — no separate deployments.

export type Tool = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  // Per-tool accent color (Tailwind-compatible CSS values).
  accent: string;
  // Internal route the "Launch" button navigates to.
  href: string;
  // Short feature bullets shown on the card.
  highlights: string[];
  // Whether the tool's demo is live yet (vs. a "being set up" placeholder).
  ready: boolean;
};

export const tools: Tool[] = [
  {
    slug: "tuesday",
    name: "Tuesday",
    tagline: "Plan the week, not the chaos",
    description:
      "Lightweight work planning that keeps every team aligned on what ships this week — boards, tasks, and owners without the overhead.",
    accent: "#6366f1",
    href: "/tuesday",
    highlights: [
      "Boards & tasks that map to how teams actually work",
      "Clear owners and due dates, zero ceremony",
      "Spin up a populated workspace in one click",
    ],
    ready: false,
  },
  {
    slug: "systemready",
    name: "SystemReady",
    tagline: "Punch lists that actually get closed out",
    description:
      "Construction commissioning and punch-list management built for the field — track defects from raised to verified across contractors and disciplines.",
    accent: "#0ea5e9",
    href: "/systemready",
    highlights: [
      "Full punch lifecycle: open → ready → verified",
      "Scoped by company, project, area, and discipline",
      "Realistic seeded jobsite to explore right away",
    ],
    ready: false,
  },
  {
    slug: "docktrail",
    name: "Docktrail",
    tagline: "Every movement, on the record",
    description:
      "Operational tracking for docks and logistics — keep an auditable trail of arrivals, handovers, and status so nothing slips between shifts.",
    accent: "#10b981",
    href: "/docktrail",
    highlights: [
      "A clean, auditable activity trail",
      "Status at a glance across every lane",
      "Jump into a live, pre-filled sandbox",
    ],
    ready: false,
  },
];

export const toolBySlug = (slug: string) =>
  tools.find((t) => t.slug === slug);
