import { useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import Type, { BodySm, Micro } from "./Type";
import { color, font, hit, radius, space } from "../constants/theme";
import { cityLabel, searchCities, type City } from "../services/cities";
import { tapFeedback } from "../services/haptics";

/**
 * Birthplace search.
 *
 * A free-text field was ambiguous ("London" could be London, Ontario) and gave
 * the chart nothing to work with. Picking from real places gives coordinates and
 * a timezone, which is what the Ascendant and the UTC birth instant need.
 */
export default function CityPicker({
  value,
  onChange,
}: {
  value: City | null;
  onChange: (city: City | null) => void;
}) {
  const [query, setQuery] = useState(value ? cityLabel(value) : "");

  const results = useMemo(
    () => (value && query === cityLabel(value) ? [] : searchCities(query, 6)),
    [query, value],
  );

  const choose = (city: City) => {
    tapFeedback();
    onChange(city);
    setQuery(cityLabel(city));
    Keyboard.dismiss();
  };

  // Visibility depends only on whether a city has been chosen — never on focus.
  // Tying it to focus hid the list on blur, which fires before the tap on a
  // result lands, so choosing a city could silently do nothing.
  const showList = !value && results.length > 0;
  const noMatch = !value && query.trim().length >= 3 && results.length === 0;

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={text => {
          setQuery(text);
          // Editing after a choice invalidates it — the label no longer
          // describes the coordinates we'd be using.
          if (value) onChange(null);
        }}
        placeholder="Search for your city"
        placeholderTextColor={color.textFaint}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="City of birth"
        maxFontSizeMultiplier={1.3}
        style={[styles.input, value && styles.inputChosen]}
      />

      {showList && (
        <View style={styles.list} accessibilityRole="list">
          {results.map((city, index) => (
            <Pressable
              key={`${city.name}-${city.latitude}-${city.longitude}`}
              accessibilityRole="button"
              accessibilityLabel={cityLabel(city)}
              onPress={() => choose(city)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
            >
              <Type variant="body" numberOfLines={1}>
                {city.name}
              </Type>
              <BodySm tone="dim" numberOfLines={1}>
                {[city.region !== city.name ? city.region : null, city.country].filter(Boolean).join(", ")}
              </BodySm>
            </Pressable>
          ))}
        </View>
      )}

      {value ? (
        <Micro tone="plus" style={styles.chosen}>
          ✓ {Math.abs(value.latitude).toFixed(2)}°{value.latitude >= 0 ? "N" : "S"} ·{" "}
          {Math.abs(value.longitude).toFixed(2)}°{value.longitude >= 0 ? "E" : "W"} · {value.timezone}
        </Micro>
      ) : noMatch ? (
        <BodySm tone="dim" style={styles.hint}>
          No match. Try the nearest larger city — it changes your chart very little.
        </BodySm>
      ) : (
        <BodySm tone="faint" style={styles.hint}>
          Not listed? Choose the nearest larger city.
        </BodySm>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 62,
    marginTop: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    color: color.textHigh,
    paddingHorizontal: space.lg,
    fontSize: 17,
    fontFamily: font.body,
  },
  inputChosen: { borderColor: color.plusBorder },
  list: {
    marginTop: space.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.bgRaised,
    overflow: "hidden",
  },
  row: { minHeight: hit.comfortable + 8, justifyContent: "center", paddingHorizontal: space.lg, paddingVertical: space.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: color.border },
  rowPressed: { backgroundColor: color.surfaceHover },
  chosen: { marginTop: space.sm, letterSpacing: 0.6 },
  hint: { marginTop: space.sm },
});
