import { ToolCard } from "@/components/tool-card";
import { tools } from "@/lib/tools";

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-16 sm:py-24">
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-[40rem] w-[60rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      {/* Hero */}
      <header className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Live, editable demos — no sign-up
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
          Don&apos;t watch a demo. Play with one.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/65">
          Each tool below opens a real, fully interactive sandbox seeded with
          realistic data. Click around, create, edit, break things — it&apos;s
          yours, and it resets daily.
        </p>
      </header>

      {/* Tool cards */}
      <section className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </section>

      {/* How it works */}
      <section className="mt-20 rounded-2xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
        <h2 className="text-center text-2xl font-semibold">
          How the sandboxes work
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "One click in",
              body: "No form, no email. You get a private workspace instantly.",
            },
            {
              step: "2",
              title: "Pre-filled & editable",
              body: "Real, realistic data is waiting. Create, edit, and delete freely — only you can see your sandbox.",
            },
            {
              step: "3",
              title: "Resets daily",
              body: "Sandboxes recycle automatically, so the next visit always starts clean.",
            },
          ].map((item) => (
            <div key={item.step}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-white/80">
                {item.step}
              </span>
              <h3 className="mt-4 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-20 border-t border-white/10 pt-8 text-center text-sm text-white/45">
        <p>
          Interactive product demos. Sandboxes are isolated per visitor and
          reset on a schedule.
        </p>
      </footer>
    </main>
  );
}
