// Lumen colours (LUMEN_SPEC.md §8.6). Additive display: bright on transparent, never dark.
export const COLORS = {
  cyan: 0x3fe0ff,
  green: 0x3dff7a,
  red: 0xff4d4d,
  amber: 0xffb020,
  white: 0xffffff,
  // Virtual bedside (light, clinical)
  bed: 0xb4bcc5,
  mattress: 0xc9d0d7,
  rail: 0xc9ced6,
  gown: 0xa9cdf2,
  skin: 0xe9e4de,
  pole: 0xc7ccd3,
  pump: 0xe4e8ed,
  pumpScreen: 0x9fd8e6,
  bag: 0xe8f4ff,
  tube: 0xe6eaee,
  cart: 0x9aa4ae,
  syringe: 0xf4f7fa,
  hub: 0xf0f0f0,
};

export const CSS = {
  cyan: "#3FE0FF",
  green: "#3DFF7A",
  red: "#FF4D4D",
  amber: "#FFB020",
  white: "#FFFFFF",
  ink: "#3a4654",
};

/** Relative luminance 0..1 of a 0xRRGGBB colour. */
export function luminance(hex: number): number {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
