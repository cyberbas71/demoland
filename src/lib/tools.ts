// Central config for the three demo tools surfaced on the hub.
//
// Each tool is deployed independently (its own repo + Vercel project + demo
// Supabase project) and is linked from here. Demo URLs are env-driven so the
// hub can point at the real demo subdomains once DNS is assigned, without a
// code change. Defaults are placeholders — override per environment in Vercel.

export type Tool = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  // Per-tool accent color (Tailwind-compatible CSS values).
  accent: string;
  // Live editable demo URL. Set via env in production.
  demoUrl: string;
  // Short feature bullets shown on the card.
  highlights: string[];
};

const env = (key: string, fallback: string) =>
  process.env[key]?.trim() || fallback;

export const tools: Tool[] = [
  {
    slug: "tuesday",
    name: "Tuesday",
    tagline: "Plan the week, not the chaos",
    description:
      "Lightweight work planning that keeps every team aligned on what ships this week — boards, tasks, and owners without the overhead.",
    accent: "#6366f1",
    demoUrl: env("NEXT_PUBLIC_TUESDAY_DEMO_URL", "https://tuesday.example.com"),
    highlights: [
      "Boards & tasks that map to how teams actually work",
      "Clear owners and due dates, zero ceremony",
      "Spin up a populated workspace in one click",
    ],
  },
  {
    slug: "systemready",
    name: "SystemReady",
    tagline: "Punch lists that actually get closed out",
    description:
      "Construction commissioning and punch-list management built for the field — track defects from raised to verified across contractors and disciplines.",
    accent: "#0ea5e9",
    demoUrl: env(
      "NEXT_PUBLIC_SYSTEMREADY_DEMO_URL",
      "https://systemready.example.com",
    ),
    highlights: [
      "Full punch lifecycle: open → ready → verified",
      "Scoped by company, project, area, and discipline",
      "Realistic seeded jobsite to explore right away",
    ],
  },
  {
    slug: "docktrail",
    name: "Docktrail",
    tagline: "Every movement, on the record",
    description:
      "Operational tracking for docks and logistics — keep an auditable trail of arrivals, handovers, and status so nothing slips between shifts.",
    accent: "#10b981",
    demoUrl: env(
      "NEXT_PUBLIC_DOCKTRAIL_DEMO_URL",
      "https://docktrail.example.com",
    ),
    highlights: [
      "A clean, auditable activity trail",
      "Status at a glance across every lane",
      "Jump into a live, pre-filled sandbox",
    ],
  },
];
