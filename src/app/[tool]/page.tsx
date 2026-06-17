import Link from "next/link";
import { notFound } from "next/navigation";
import { tools, toolBySlug } from "@/lib/tools";

// Pre-render the known tool routes. Each will be replaced by the real demo app
// once that tool's code is merged in.
export function generateStaticParams() {
  return tools.map((t) => ({ tool: t.slug }));
}

export default async function ToolPlaceholder({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool: slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) notFound();

  return (
    <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <span
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-white"
        style={{ background: tool.accent }}
      >
        {tool.name.charAt(0)}
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">
        {tool.name} demo
      </h1>
      <p className="mt-4 max-w-md text-white/65">
        This interactive demo is being set up. Soon you&apos;ll get your own
        private, pre-filled {tool.name} sandbox to explore right here — no
        sign-up, resets daily.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]"
      >
        <span aria-hidden>←</span> Back to all demos
      </Link>
    </main>
  );
}
