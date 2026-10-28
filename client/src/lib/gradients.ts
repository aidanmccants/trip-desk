// Trip cover gradients. Tripsy stores `cover_gradient` as an integer index but doesn't
// document the palette, so this is the app's own set, indexed the same way.
export const GRADIENTS: string[] = [
  'linear-gradient(135deg, #FF9A3C 0%, #F0461E 100%)',
  'linear-gradient(135deg, #5B8CFF 0%, #2440B8 100%)',
  'linear-gradient(135deg, #C86DD7 0%, #3023AE 100%)',
  'linear-gradient(135deg, #43E97B 0%, #1C8F7A 100%)',
  'linear-gradient(135deg, #FA709A 0%, #C2185B 100%)',
  'linear-gradient(135deg, #30CFD0 0%, #2C3E8F 100%)',
  'linear-gradient(135deg, #F6D365 0%, #FDA085 100%)',
  'linear-gradient(135deg, #434343 0%, #111111 100%)',
  'linear-gradient(135deg, #A18CD1 0%, #FBC2EB 100%)',
  'linear-gradient(135deg, #0BA360 0%, #3CBA92 100%)',
  'linear-gradient(135deg, #FF5858 0%, #F09819 100%)',
  'linear-gradient(135deg, #1E3C72 0%, #2A5298 100%)',
];

export function gradientFor(index: number | null | undefined, fallbackSeed = 0): string {
  const i = index ?? fallbackSeed;
  return GRADIENTS[((i % GRADIENTS.length) + GRADIENTS.length) % GRADIENTS.length];
}

/** CSS background for a trip cover: the photo if set, else its gradient. */
export function coverBackground(trip: { cover_image_url: string | null; cover_gradient: number | null; id: number }): string {
  if (trip.cover_image_url) return `center / cover no-repeat url("${trip.cover_image_url.replace(/"/g, '%22')}")`;
  return gradientFor(trip.cover_gradient, trip.id);
}
