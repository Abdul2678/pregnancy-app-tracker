// constants/theme.ts
// Centralised design tokens used across the app.

export const colors = {
  // ── Backgrounds ────────────────────────────────────────────────────────
  bg:           '#FDF0F8',  // Soft pink-white  (onboarding + new screens)
  bgWarm:       '#F4F1EA',  // Original warm cream (legacy screens)
  surface:      '#FFFFFF',
  surfacePink:  '#FFF7FB',
  surfacePurple:'#F8F2FF',

  // ── Rose (primary) ─────────────────────────────────────────────────────
  rose:         '#CC6E9A',
  roseDark:     '#A8527A',
  roseMid:      '#E09AB8',
  roseLight:    '#FAEAF3',
  rosePale:     '#FDF0F8',

  // ── Lavender (accent) ──────────────────────────────────────────────────
  lavender:     '#8E72B8',
  lavenderDark: '#6E52A0',
  lavenderMid:  '#B09AD8',
  lavenderLight:'#EBE3F9',
  lavenderPale: '#F7F2FF',

  // ── Text ───────────────────────────────────────────────────────────────
  textDeep:     '#3D1440',  // Deep warm purple-black
  textBody:     '#6B4680',  // Body text
  textMuted:    '#A888BE',
  textLight:    '#C8B8D8',

  // ── Borders / strokes ──────────────────────────────────────────────────
  border:       '#EDD8F2',
  borderLight:  '#F5ECF9',

  // ── Utility ────────────────────────────────────────────────────────────
  white:        '#FFFFFF',
  black:        '#000000',
  coral:        '#C97B63',  // Original brand coral — keep for continuity
  error:        '#D63B5A',
  errorLight:   '#FDEDF0',
  success:      '#4EA86A',
  successLight: '#E8F5ED',
} as const;

export const spacing = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
  xxxl: 64,
} as const;

export const radius = {
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  pill: 9999,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#8E72B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#8E72B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#3D1440',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;
