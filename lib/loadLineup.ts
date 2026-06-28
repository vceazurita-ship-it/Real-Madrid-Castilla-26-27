import { LineupSlot } from "@/types/player";

export function loadLineup(
  json: string
): LineupSlot[] {

  return JSON.parse(json);

}