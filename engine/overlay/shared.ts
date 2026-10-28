export interface RoundView {
  number: number;
  phase: 'pitch' | 'vote' | 'approval' | 'building' | 'paused';
  remainingMs: number | null;
  candidates: { id: string; text: string; spec?: string; authorName: string; contributors?: string[]; votes: string[]; status: string }[];
  triagePreview?: { id: string; decision: 'accept' | 'reject' | 'merge'; spec?: string; duplicateId?: string }[];
}
export interface RunView { id: string; ideaId: string; status: string; mutationName?: string; threadId?: string; durationMs?: number; error?: string }
export interface RunnerProgressView { runId: string; ideaId: string; type: string; message?: string; at: string }
export interface MutationView { name: string; source: string; error?: string }

export async function dashboardData() {
  const [roundResponse, runsResponse, mutationsResponse, ideasResponse, eventsResponse] = await Promise.all([
    fetch('/api/round'), fetch('/api/runs'), fetch('/api/mutations'), fetch('/api/ideas'), fetch('/api/runner-events')
  ]);
  if (![roundResponse, runsResponse, mutationsResponse, ideasResponse, eventsResponse].every(response => response.ok)) throw Error('Dashboard data unavailable');
  const round = await roundResponse.json() as RoundView;
  const runs = (await runsResponse.json() as { runs: RunView[] }).runs;
  const mutations = await mutationsResponse.json() as MutationView[];
  const ideas = (await ideasResponse.json() as { ideas: RoundView['candidates'] }).ideas;
  const events = (await eventsResponse.json() as { events: RunnerProgressView[] }).events;
  return { round, runs, mutations, ideas, events };
}

export function appendText(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, value: string, className?: string) {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

export function roundClock(ms: number | null) { return ms === null ? '—' : `${Math.ceil(ms / 1000)}s`; }
