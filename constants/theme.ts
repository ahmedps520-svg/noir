import { Platform, type TextStyle } from "react-native";

/**
 * NOIR design tokens.
 *
 * Two typefaces carry the brand:
 *   Cormorant Garamond — a high-contrast display serif for the emotional
 *     moments (the wordmark, archetype names, screen headlines). This is what
 *     stops NOIR looking like a default React Native app.
 *   Inter — everything functional. Designed for screens, so it stays legible
 *     at the small sizes labels and metadata need.
 *
 * Every colour below is checked against the #050505 background. Anything used
 * for text at or below 18px clears WCAG AA (4.5:1); the previous palette used
 * #444–#737373 for 9px labels, all of which failed.
 */

export const font = {
  display: "CormorantGaramond_400Regular",
  displayLight: "CormorantGaramond_300Light",
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
} as const;

export const color = {
  bg: "#050505",
  /** Slightly lifted ground for sheets and full-bleed cards. */
  bgRaised: "#0B0B0C",

  /** Layered surfaces — each step reads as one level closer to the viewer. */
  surface: "rgba(255,255,255,0.05)",
  surfaceHover: "rgba(255,255,255,0.09)",
  surfaceStrong: "rgba(255,255,255,0.13)",

  border: "rgba(255,255,255,0.11)",
  borderStrong: "rgba(255,255,255,0.2)",

  /** Text ramp. Contrast vs #050505 noted; never go below textDim for copy. */
  textHigh: "#F2F2F2", // 18.0:1
  text: "#E4E4E4", // 15.8:1
  textMuted: "#A8A8A8", // 8.5:1
  textDim: "#8C8C8C", // 6.1:1
  /**
   * The quietest text NOIR uses — legal copy, separators, metadata. Still
   * clears AA (4.8:1), because "decorative" grey has a habit of ending up on
   * text that matters. If something genuinely needs to recede further, drop its
   * opacity at the call site rather than adding a failing token here.
   */
  textFaint: "#7C7C7C", // 4.8:1

  /** Inverted, for use on the white filled button. */
  onLight: "#050505",
  onLightMuted: "#4A4A4A",

  /**
   * NOIR+ champagne. Used sparingly — the paid tier is the only place colour
   * appears, which is what makes it feel like an upgrade.
   */
  plus: "#D8C49A",
  plusDim: "#9A8B6B",
  plusSurface: "rgba(216,196,154,0.09)",
  plusBorder: "rgba(216,196,154,0.28)",

  danger: "#D89A9A",
  success: "#9FBFA4",
  notice: "#93A7C4",
} as const;

/** 4pt rhythm. Use these instead of arbitrary margins. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radius = {
  sm: 14,
  md: 20,
  lg: 26,
  xl: 32,
  pill: 999,
} as const;

/**
 * iOS Human Interface Guidelines put the minimum comfortable target at 44pt.
 * NOIR uses 48 for primary controls.
 */
export const hit = {
  min: 44,
  comfortable: 48,
  button: 58,
} as const;

/**
 * Type scale.
 *
 * Nothing here is smaller than 11px. The old design used 8–9px for 77 separate
 * labels, with up to 3px of tracking — a third of the glyph size — which is
 * what made the app feel unreadable rather than minimal.
 */
export const type = {
  /** The NOIR wordmark and the single hero moment on a screen. */
  hero: {
    fontFamily: font.displayLight,
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: 2,
    color: color.textHigh,
  },
  /** Screen headline. */
  display: {
    fontFamily: font.displayLight,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: 0.2,
    color: color.textHigh,
  },
  /** Archetype names, section openers. */
  h1: {
    fontFamily: font.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 0.2,
    color: color.textHigh,
  },
  h2: {
    fontFamily: font.display,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0.2,
    color: color.textHigh,
  },
  /** Card titles — Inter, because these sit next to functional copy. */
  title: {
    fontFamily: font.semibold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: color.textHigh,
  },
  /** Reading copy. Generous leading — this is what people actually read. */
  body: {
    fontFamily: font.body,
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0,
    color: color.text,
  },
  bodySm: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0,
    color: color.textMuted,
  },
  /** Uppercase section labels — the app's technical accent, kept legible. */
  label: {
    fontFamily: font.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    color: color.textMuted,
  },
  /** Smallest permitted size. Metadata, nav, eyebrow text. */
  micro: {
    fontFamily: font.medium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1,
    color: color.textDim,
  },
  /** Button text. */
  button: {
    fontFamily: font.semibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.2,
    color: color.textHigh,
  },
} satisfies Record<string, TextStyle>;

/**
 * Dynamic Type can triple a label's size and break these layouts. Cap the
 * multiplier rather than disabling scaling outright, so the app still responds
 * to accessibility settings without collapsing.
 */
export const maxScale = {
  display: 1.3,
  body: 1.6,
  label: 1.4,
} as const;

/** Soft glow used on premium surfaces. iOS-only; Android ignores shadowRadius. */
export const glow = Platform.select({
  ios: {
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  default: {},
});

/**
 * Legacy alias.
 *
 * The original theme exported a flat `C` object. Screens are migrating to the
 * tokens above; this keeps anything not yet converted rendering correctly, and
 * now points at the accessible colours rather than the failing greys.
 */
export const C = {
  bg: color.bg,
  surface: color.surface,
  surface2: color.surfaceHover,
  border: color.border,
  white: color.textHigh,
  text: color.text,
  muted: color.textMuted,
  dim: color.textFaint,
};
