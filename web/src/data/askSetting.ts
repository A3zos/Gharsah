// The parent's «السماح بميزة اسألني» per child — UI ONLY for now: kept in this browser
// (localStorage), default on. The child's device can't see it yet.
// TODO(ask): a children.ask_allowed column (migration + RLS + the child app reading it)
// before «اسألني» is connected to the AI server.
const key = (childId: string) => `gh.askAllowed.${childId}`;

export function askAllowed(childId: string | null | undefined): boolean {
  if (!childId) return true;
  try {
    return localStorage.getItem(key(childId)) !== '0';
  } catch {
    return true; // storage blocked → the default
  }
}

export function setAskAllowed(childId: string, on: boolean): void {
  try {
    localStorage.setItem(key(childId), on ? '1' : '0');
  } catch {
    // storage blocked (private mode): the choice lasts this visit only
  }
}
