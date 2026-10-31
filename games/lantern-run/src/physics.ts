export interface FlightState { y: number; vy: number; jumpLift: number }

export function advanceFoxFlight(state: FlightState, dt: number, gravity: number, held: boolean, gliding: boolean): FlightState {
  let { y, vy, jumpLift } = state;
  if (held && vy < 0 && jumpLift < .16) { vy -= 450 * dt; jumpLift += dt; }
  vy = Math.max(-1200, Math.min(gliding ? 280 : 1800, vy + gravity * dt));
  y += vy * dt;
  return { y, vy, jumpLift };
}
