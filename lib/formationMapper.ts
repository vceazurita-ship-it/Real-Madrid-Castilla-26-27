import { LineupSlot } from "@/types/player";

const equivalents: Record<string, string[]> = {
  POR: ["POR"],

  LI: ["LI", "CAI"],
  CAI: ["CAI", "LI"],

  LD: ["LD", "CAD"],
  CAD: ["CAD", "LD"],

  DFC1: ["DFC1", "DFC2", "DFC3"],
  DFC2: ["DFC2", "DFC1", "DFC3"],
  DFC3: ["DFC3", "DFC2", "DFC1"],

  MC1: ["MC1", "MC2", "MC3", "MCD1", "MCD2", "MCO"],
  MC2: ["MC2", "MC1", "MC3", "MCD1", "MCD2", "MCO"],
  MC3: ["MC3", "MC2", "MC1", "MCD2", "MCD1", "MCO"],

  MCD1: ["MCD1", "MC1", "MC2"],
  MCD2: ["MCD2", "MC2", "MC3"],

  MCO: ["MCO", "DC2", "MC2"],

  MI: ["MI", "EI", "CAI"],
  MD: ["MD", "ED", "CAD"],

  EI: ["EI", "MI"],
  ED: ["ED", "MD"],

  DC: ["DC", "DC1", "DC2"],
  DC1: ["DC1", "DC", "MCO"],
  DC2: ["DC2", "DC", "MCO"],
};

export function remapFormation(
  oldLineup: LineupSlot[],
  newLineup: LineupSlot[]
): LineupSlot[] {
  const result = newLineup.map(
  (s): LineupSlot => ({
    ...s,
    playerId: null,
  })
);

  const used = new Set<string>();

  for (const oldSlot of oldLineup) {
    if (!oldSlot.playerId) continue;

    const priority =
      equivalents[oldSlot.positionId] ??
      [oldSlot.positionId];

    for (const target of priority) {
      const destination = result.find(
        (slot) =>
          slot.positionId === target &&
          slot.playerId === null
      );

      if (destination) {
        destination.playerId = oldSlot.playerId;
        used.add(oldSlot.playerId);
        break;
      }
    }
  }

  return result;
}