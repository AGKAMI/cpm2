import { carsForGame } from "./car-catalog.ts";
import { GARAGE_RULES, type GameType } from "./constants.ts";

/**
 * The garage shape of one account: what it owns and what it may own.
 *
 * `baseSlots` and `slots` only mean anything in CPM2 — CPM1 has no slots at
 * all. `newGarage` is the purchasable second garage (R299.99), which only
 * exists in CPM2 either.
 */
export type GarageShape = {
  baseSlots: number;
  slots: number;
  newGarage: boolean;
};

/**
 * How many cars one account can hold, under ITS game's rules.
 *
 * CPM1: no slots — the whole catalog, one of each model (207 cars).
 * CPM2: base slots + the coin-bought slot + the second garage's 15 slots.
 */
export function garageCapacity(game: GameType, shape: GarageShape): number {
  if (game === "cpm1") {
    return carsForGame("cpm1").length;
  }

  return (
    Math.max(0, Math.trunc(shape.baseSlots || 0)) +
    Math.max(0, Math.trunc(shape.slots || 0)) +
    (shape.newGarage ? GARAGE_RULES.cpm2.newGarageSlots : 0)
  );
}

/** True when the game has car slots at all (CPM1 does not). */
export function hasCarSlots(game: GameType): boolean {
  return GARAGE_RULES[game].hasSlots;
}

/** True when the same model may be parked more than once. */
export function allowsDuplicateModels(game: GameType): boolean {
  return GARAGE_RULES[game].allowDuplicateModels;
}
