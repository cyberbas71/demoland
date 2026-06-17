import type { Tool } from "@/lib/tools";

export function ToolCard({ tool }: { tool: Tool }) {
  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition hover:border-white/25 hover:bg-white/[0.06]"
      style={{ ["--accent" as string]: tool.accent }}
    >
      {/* Accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl transition group-hover:opacity-40"
        style={{ background: tool.accent }}
      />

      <div className="mb-5 flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white"
          style={{ background: tool.accent }}
        >
          {tool.name.charAt(0)}
        </span>
        <div>
          <h3 className="text-xl font-semibold leading-tight">{tool.name}</h3>
          <p className="text-sm text-white/60">{tool.tagline}</p>
        </div>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-white/70">
        {tool.description}
      </p>

      <ul className="mb-7 space-y-2 text-sm text-white/60">
        {tool.highlights.map((h) => (
          <li key={h} className="flex gap-2">
            <span
              aria-hidden
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: tool.accent }}
            />
            <span>{h}</span>
          </li>
        ))}
      </ul>

      <a
        href={tool.demoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition group-hover:brightness-110"
        style={{ background: tool.accent }}
      >
        Launch interactive demo
        <span aria-hidden className="transition group-hover:translate-x-0.5">
          →
        </span>
      </a>
    </article>
  );
}
