import { StyleSheet, View } from "react-native";
import Type, { Micro } from "./Type";
import { color, space } from "../constants/theme";
import { findPlacement, type NatalChart } from "../services/chart";

/**
 * The "big three" — Sun, Moon, Rising — computed from the person's actual
 * birth time and place. Shown wherever a reading appears, so the chart behind
 * it is visible rather than taken on trust.
 */
export default function ChartSignature({ chart }: { chart: NatalChart | null }) {
  if (!chart) return null;

  const items = [
    { glyph: "☉", label: "Sun", p: findPlacement(chart, "Sun") },
    { glyph: "☽", label: "Moon", p: findPlacement(chart, "Moon") },
    { glyph: "↑", label: "Rising", p: findPlacement(chart, "Ascendant") },
  ];

  return (
    <View style={styles.row} accessibilityRole="summary">
      {items.map(({ glyph, label, p }) =>
        p ? (
          <View
            key={label}
            style={styles.item}
            accessible
            accessibilityLabel={`${label} in ${p.sign}, ${p.degree} degrees`}
          >
            <Type variant="title" tone="plus" style={styles.glyph}>
              {glyph}
            </Type>
            <View>
              <Micro tone="dim">{label}</Micro>
              <Type variant="body" tone="high">
                {p.sign}
              </Type>
            </View>
          </View>
        ) : null,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.lg,
    marginTop: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.border,
  },
  item: { flexDirection: "row", alignItems: "center", gap: space.sm },
  glyph: { width: 22, textAlign: "center" },
});
