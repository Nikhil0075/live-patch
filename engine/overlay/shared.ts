export interface RoundView {
  number: number;
  phase: 'pitch' | 'vote' | 'approval' | 'building' | 'paused';
  remainingMs: number | null;
  candidates: { id: string; text: string; spec?: string; authorName: string; contributors?: string[]; votes: string[]; status: string }[];
}
export interface RunView { id: string; ideaId: string; status: string; mutationName?: string; threadId?: string; durationMs?: number; error?: string }
export interface MutationView { name: string; source: string; error?: string }

export async function dashboardData() {
  const [roundResponse, runsResponse, mutationsResponse, ideasResponse] = await Promise.all([
    fetch('/api/round'), fetch('/api/runs'), fetch('/api/mutations'), fetch('/api/ideas')
  ]);
  if (![roundResponse, runsResponse, mutationsResponse, ideasResponse].every(response => response.ok)) throw Error('Dashboard data unavailable');
  const round = await roundResponse.json() as RoundView;
  const runs = (await runsResponse.json() as { runs: RunView[] }).runs;
  const mutations = await mutationsResponse.json() as MutationView[];
  const ideas = (await ideasResponse.json() as { ideas: RoundView['candidates'] }).ideas;
  return { round, runs, mutations, ideas };
}

export function appendText(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, value: string, className?: string) {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

export function roundClock(ms: number | null) { return ms === null ? '—' : `${Math.ceil(ms / 1000)}s`; }
