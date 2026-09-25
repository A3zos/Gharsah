/**
 * Parental gate before any parent area (CLAUDE.md §3.2, Designed for Families).
 * TODO(design): pass-through until the design revision delivers the gate screen;
 * every /parent route already renders inside it, so only this file changes.
 */
export function ParentalGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
