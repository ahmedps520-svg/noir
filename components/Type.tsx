import { Text, type TextProps, type TextStyle } from "react-native";
import { color, maxScale, type } from "../constants/theme";

type Variant = keyof typeof type;

type TypeProps = TextProps & {
  variant?: Variant;
  /** Convenience override so screens don't need a StyleSheet entry per colour. */
  tone?: "high" | "default" | "muted" | "dim" | "faint" | "plus" | "danger" | "onLight";
  center?: boolean;
  uppercase?: boolean;
};

const TONE: Record<NonNullable<TypeProps["tone"]>, string> = {
  high: color.textHigh,
  default: color.text,
  muted: color.textMuted,
  dim: color.textDim,
  faint: color.textFaint,
  plus: color.plus,
  danger: color.danger,
  onLight: color.onLight,
};

/** Bigger type breaks layout sooner, so cap its growth more tightly. */
function scaleCapFor(variant: Variant) {
  if (variant === "hero" || variant === "display" || variant === "h1" || variant === "h2") {
    return maxScale.display;
  }
  if (variant === "label" || variant === "micro" || variant === "button") return maxScale.label;
  return maxScale.body;
}

/**
 * All NOIR text goes through here.
 *
 * Screens used to declare fontSize/letterSpacing inline, which is how the app
 * ended up with 77 separate 8–9px labels and tracking as wide as a third of the
 * glyph. Centralising it means the scale can only be changed on purpose.
 */
export default function Type({
  variant = "body",
  tone,
  center,
  uppercase,
  style,
  ...rest
}: TypeProps) {
  const base = type[variant] as TextStyle;

  return (
    <Text
      maxFontSizeMultiplier={scaleCapFor(variant)}
      style={[
        base,
        tone ? { color: TONE[tone] } : null,
        center ? { textAlign: "center" } : null,
        uppercase ? { textTransform: "uppercase" } : null,
        style,
      ]}
      {...rest}
    />
  );
}

/** Shorthands for the variants used most, purely to keep JSX readable. */
export const Hero = (p: Omit<TypeProps, "variant">) => <Type variant="hero" {...p} />;
export const Display = (p: Omit<TypeProps, "variant">) => <Type variant="display" {...p} />;
export const H1 = (p: Omit<TypeProps, "variant">) => <Type variant="h1" {...p} />;
export const H2 = (p: Omit<TypeProps, "variant">) => <Type variant="h2" {...p} />;
export const Title = (p: Omit<TypeProps, "variant">) => <Type variant="title" {...p} />;
export const Body = (p: Omit<TypeProps, "variant">) => <Type variant="body" {...p} />;
export const BodySm = (p: Omit<TypeProps, "variant">) => <Type variant="bodySm" {...p} />;

/** Uppercase by default — these are the app's technical accent. */
export const Label = (p: Omit<TypeProps, "variant">) => (
  <Type variant="label" uppercase {...p} />
);
export const Micro = (p: Omit<TypeProps, "variant">) => (
  <Type variant="micro" uppercase {...p} />
);
