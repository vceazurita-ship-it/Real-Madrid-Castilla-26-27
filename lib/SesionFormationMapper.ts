import { MicroLineupSlot } from "@/types/MicroPlayer";

const equivalents: Record<string, string[]> = {
  POR: ["POR"],

  LI: ["LI"],
  LD: ["LD"],

  DFC1: ["DFC1", "DFC2", "DFC3"],
  DFC2: ["DFC2", "DFC1", "DFC3"],
  DFC3: ["DFC3", "DFC2", "DFC1"],

  MC6: ["MC6", "MC8", "MC10"],
  MC8: ["MC8", "MC6", "MC10"],
  MC10: ["MC10", "MC8", "MC6"],

  EI: ["EI", "ED", "DC2"],
  ED: ["ED", "EI", "DC2"],

  DC1: ["DC1", "DC2"],
  DC2: ["DC2", "DC1"],
};

export function remapSessionFormation(
  oldLineup: MicroLineupSlot[],
  newLineup: MicroLineupSlot[]
): MicroLineupSlot[] {
  const result: MicroLineupSlot[] = newLineup.map((slot) => ({
    ...slot,
    playerIds: [],
  }));

  for (const oldSlot of oldLineup) {
    if (!oldSlot.playerIds.length) continue;

    const priorities =
      equivalents[oldSlot.positionId] ?? [oldSlot.positionId];

    for (const playerId of oldSlot.playerIds) {
      let placed = false;

      for (const target of priorities) {
        const destination = result.find(
          (slot) =>
            slot.positionId === target &&
            slot.playerIds.length === 0
        );

        if (destination) {
          destination.playerIds.push(playerId);
          placed = true;
          break;
        }
      }

      if (!placed) {
        const free = result.find(
          (slot) => slot.playerIds.length === 0
        );

        if (free) {
          free.playerIds.push(playerId);
        }
      }
    }
  }

  return result;
}