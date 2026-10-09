import { Linking, Pressable, StyleSheet, Switch, View } from "react-native";
import Card from "./Card";
import Type, { BodySm, Label, Micro } from "./Type";
import { color, hit, radius, space } from "../constants/theme";
import { useDailyReminder } from "../hooks/useDailyReminder";
import { formatReminderTime } from "../services/notifications";
import { tapFeedback } from "../services/haptics";

/**
 * Reminder toggle plus an hour stepper.
 *
 * An hour stepper rather than a wheel picker on purpose: it needs no extra
 * native dependency, and nobody sets a habit reminder to 8:37.
 */
export default function ReminderControl({ entitled }: { entitled: boolean }) {
  const { preference, permission, loading, busy, toggle, setTime, supported } = useDailyReminder();

  if (!supported) return null;

  const blocked = permission === "denied" && !preference.enabled;

  const shiftHour = (delta: number) => {
    tapFeedback();
    const hour = (preference.hour + delta + 24) % 24;
    setTime(hour, preference.minute);
  };

  return (
    <Card tone={preference.enabled ? "plus" : "default"}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Label tone={preference.enabled ? "plus" : "muted"}>Daily reminder</Label>
          <BodySm tone="muted" style={styles.sub}>
            {entitled
              ? "A quiet nudge when your reading is ready."
              : "Available with NOIR+, alongside daily readings."}
          </BodySm>
        </View>

        <Switch
          value={preference.enabled}
          disabled={!entitled || loading || busy}
          onValueChange={value => {
            tapFeedback();
            toggle(value);
          }}
          trackColor={{ false: color.surfaceStrong, true: color.plusDim }}
          thumbColor={preference.enabled ? color.plus : color.textDim}
          ios_backgroundColor={color.surfaceStrong}
        />
      </View>

      {preference.enabled && (
        <View style={styles.timeRow}>
          <Stepper label="Earlier" symbol="−" onPress={() => shiftHour(-1)} />
          <View style={styles.timeValue}>
            <Type variant="h1" tone="plus">
              {formatReminderTime(preference.hour, preference.minute)}
            </Type>
            <Micro tone="faint">every day</Micro>
          </View>
          <Stepper label="Later" symbol="+" onPress={() => shiftHour(1)} />
        </View>
      )}

      {blocked && (
        <Pressable
          onPress={() => Linking.openSettings()}
          accessibilityRole="button"
          style={styles.blocked}
        >
          <BodySm tone="danger">
            Notifications are turned off for NOIR. Open iOS Settings to allow them.
          </BodySm>
        </Pressable>
      )}
    </Card>
  );
}

function Stepper({
  label,
  symbol,
  onPress,
}: {
  label: string;
  symbol: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.stepper, pressed && styles.stepperPressed]}
    >
      <Type variant="h2" tone="plus">
        {symbol}
      </Type>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.lg },
  headText: { flex: 1 },
  sub: { marginTop: space.xs + 2 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xl,
    paddingTop: space.xl,
    borderTopWidth: 1,
    borderTopColor: color.plusBorder,
  },
  timeValue: { alignItems: "center", gap: space.xs },
  stepper: {
    width: hit.comfortable,
    height: hit.comfortable,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.plusBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperPressed: { backgroundColor: color.plusSurface, transform: [{ scale: 0.96 }] },
  blocked: { marginTop: space.lg },
});
