export interface GameEvent { type: string; origin?: string; [key: string]: unknown }
export interface GameAction { type: string; args: unknown[] }
export interface GameAdapter {
  apply(action: GameAction, origin: string): void;
  enableSound?(): void;
  configure?(settings: unknown): void;
  pause?(): void;
  resume?(): void;
  removeMutation(origin: string): void;
  snapshot(): unknown;
  destroy(): void;
}
