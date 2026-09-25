/**
 * Placeholder for a route whose design frame hasn't been built yet (or doesn't
 * exist yet — see CLAUDE.md "no invented layouts"). Deliberately plain: it is
 * scaffolding, not a design. Every use is replaced as its frame is built.
 */
export function PendingDesign({ name }: { name: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <p className="text-text-muted">{name}</p>
    </main>
  );
}
