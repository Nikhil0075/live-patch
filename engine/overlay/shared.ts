export interface RoundView {
  number: number;
  phase: 'pitch' | 'vote' | 'approval' | 'building' | 'paused';
  remainingMs: number | null;
  candidates: { id: string; text: string; spec?: string; authorName: string; contributors?: string[]; votes: string[]; status: string; source?: 'chat' | 'reward'; createdAt?: string; updatedAt?: string; practice?: boolean }[];
  triagePreview?: { id: string; decision: 'accept' | 'reject' | 'merge'; spec?: string; duplicateId?: string }[];
}
export interface RunView { id: string; ideaId: string; status: string; mutationName?: string; mutationTitle?: string; threadId?: string; durationMs?: number; error?: string; demo?: boolean; startedAt?: string; finishedAt?: string }
export interface RunnerProgressView { runId: string; ideaId: string; type: string; message?: string; at: string }
export interface MutationView { name: string; source: string; error?: string }
import type { OverlayWidget } from '../studio/settings-defaults';
export interface SettingsView { reduceFlashing: boolean; overlayCompact: boolean; muted: boolean; pitchSeconds: number; voteSeconds: number; overlayWidgets: OverlayWidget[] }

export async function dashboardData() {
  const [roundResponse, runsResponse, mutationsResponse, ideasResponse, eventsResponse, settingsResponse] = await Promise.all([
    fetch('/api/round'), fetch('/api/runs'), fetch('/api/mutations'), fetch('/api/ideas'), fetch('/api/runner-events'), fetch('/api/settings')
  ]);
  if (![roundResponse, runsResponse, mutationsResponse, ideasResponse, eventsResponse, settingsResponse].every(response => response.ok)) throw Error('Dashboard data unavailable');
  const round = await roundResponse.json() as RoundView;
  const runs = (await runsResponse.json() as { runs: RunView[] }).runs;
  const mutations = await mutationsResponse.json() as MutationView[];
  const ideaData = await ideasResponse.json() as { ideas: RoundView['candidates']; rollbackVote?: { votes: number; threshold: number; ready: boolean; expiresAt: number } };
  const ideas = ideaData.ideas;
  const events = (await eventsResponse.json() as { events: RunnerProgressView[] }).events;
  const settings = await settingsResponse.json() as SettingsView;
  return { round, runs, mutations, ideas, rollbackVote: ideaData.rollbackVote, events, settings };
}

export function appendText(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, value: string, className?: string) {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

export function roundClock(ms: number | null) { return ms === null ? '—' : `${Math.ceil(ms / 1000)}s`; }
