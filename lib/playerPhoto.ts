const DEFAULT_PHOTO =
  "/images/player-placeholder.png";

export function getPlayerPhoto(
  photoUrl?: string | null
) {
  if (photoUrl && photoUrl.trim() !== "") {
    return photoUrl;
  }

  return DEFAULT_PHOTO;
}