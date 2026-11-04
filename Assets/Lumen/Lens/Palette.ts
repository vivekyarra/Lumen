/** Lumen colours (LUMEN_SPEC.md §8.6). Additive display: bright on transparent, never dark. */
export const HEX = {
  cyan: 0x3fe0ff,
  green: 0x3dff7a,
  red: 0xff4d4d,
  amber: 0xffb020,
  white: 0xffffff,
  bed: 0xd9dde2,
  mattress: 0xeef1f4,
  rail: 0xc9ced6,
  gown: 0xa9cdf2,
  skin: 0xe9e4de,
  pole: 0xc7ccd3,
  pump: 0xe4e8ed,
  pumpScreen: 0x9fd8e6,
  bag: 0xe8f4ff,
  tube: 0xe6eaee,
  cart: 0xd5dbe2,
  syringe: 0xf4f7fa,
  hub: 0xf0f0f0,
};

/** Relative luminance (0..1) of 0xRRGGBB. */
export function luminance(hex: number): number {
  return (0.2126 * ((hex >> 16) & 255) + 0.7152 * ((hex >> 8) & 255) + 0.0722 * (hex & 255)) / 255;
}

/** Number of palette colours dark enough to vanish on an additive display (must be 0). */
export function darkPaletteEntries(): number {
  let n = 0;
  const keys = Object.keys(HEX) as (keyof typeof HEX)[];
  for (let i = 0; i < keys.length; i++) if (luminance(HEX[keys[i]]) < 0.3) n++;
  return n;
}
