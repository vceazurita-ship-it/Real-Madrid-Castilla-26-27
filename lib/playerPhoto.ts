import {
  PLAYER_PHOTO_FALLBACK,
  getPlayerPhotoSrc,
  type PlayerImageVariant,
} from "./playerImages";

/**
 * Foto de un jugador. Prefiere el recorte local; si esa persona no lo tiene,
 * usa la URL recibida y, en último caso, el placeholder.
 */
export function getPlayerPhoto(
  photoUrl?: string | null,
  nombre?: string | null,
  variant: PlayerImageVariant = "cerca",
  id?: string | null
) {
  return getPlayerPhotoSrc(nombre, { id, variant, fallbackUrl: photoUrl });
}

export { PLAYER_PHOTO_FALLBACK };
