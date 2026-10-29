export interface DemoCandidate { id: string; practice?: boolean }

export function practiceDemoEligible(phase: string, candidates: DemoCandidate[], ideaId: string | undefined, liveChatConnected: boolean): boolean {
  return phase === 'approval' && !liveChatConnected && candidates.length > 0 &&
    candidates.every(candidate => candidate.practice) &&
    candidates.some(candidate => candidate.id === ideaId);
}
