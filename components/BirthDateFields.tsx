import { useRef } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Type, { BodySm, Label, Micro } from "./Type";
import { color, font, hit, radius, space } from "../constants/theme";

const INPUT_ACCESSORY_ID = "noir-birth-keyboard-done";

export type BirthFields = {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
};

export const EMPTY_BIRTH_FIELDS: BirthFields = {
  day: "",
  month: "",
  year: "",
  hour: "",
  minute: "",
};

/** "DD/MM/YYYY", or "" until every part is present. */
export function formatBirthDate(fields: BirthFields) {
  const { day, month, year } = fields;
  if (!day || !month || !year) return "";
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

/** 24-hour "HH:MM", or "" until both parts are present. */
export function formatBirthTime(fields: BirthFields) {
  const { hour, minute } = fields;
  if (!hour || !minute) return "";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/** Returns a human-readable problem, or null when the entry is usable. */
export function validateBirthFields(fields: BirthFields): string | null {
  const { day, month, year, hour, minute } = fields;
  if (!day || !month || !year || !hour || !minute) return null;

  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  const h = Number(hour);
  const min = Number(minute);
  const currentYear = new Date().getFullYear();

  if (m < 1 || m > 12) return "Month must be between 01 and 12.";
  if (y < 1900 || y > currentYear) return `Year must be between 1900 and ${currentYear}.`;

  const daysInMonth = new Date(y, m, 0).getDate();
  if (d < 1 || d > daysInMonth) return `That month only has ${daysInMonth} days.`;
  if (h > 23) return "Use 24-hour time — hour must be 00 to 23.";
  if (min > 59) return "Minutes must be between 00 and 59.";

  const birth = new Date(y, m - 1, d, h, min);
  if (birth.getTime() > Date.now()) return "That date is in the future.";

  return null;
}

export function isBirthFieldsComplete(fields: BirthFields) {
  return (
    fields.day.length >= 1 &&
    fields.month.length >= 1 &&
    fields.year.length === 4 &&
    fields.hour.length >= 1 &&
    fields.minute.length >= 1
  );
}

export default function BirthDateFields({
  fields,
  onChange,
}: {
  fields: BirthFields;
  /**
   * Must be a state setter, not a plain callback — see `set` below for why a
   * functional update is required here.
   */
  onChange: React.Dispatch<React.SetStateAction<BirthFields>>;
}) {
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const hourRef = useRef<TextInput>(null);
  const minuteRef = useRef<TextInput>(null);

  const set = (key: keyof BirthFields, value: string, advanceAt?: number, next?: typeof monthRef) => {
    const digits = value.replace(/\D/g, "");

    // Functional update, NOT `{ ...fields, [key]: digits }`. These boxes
    // auto-advance, so a fast typist changes two fields within one render —
    // and spreading the captured `fields` would write a stale sibling back,
    // wiping the digits just entered next door.
    onChange(previous => ({ ...previous, [key]: digits }));

    // Move the caret along as each part fills up so nobody has to aim at a
    // small box between every two digits.
    //
    // Focus moves synchronously. Deferring it by a frame was tried and is
    // measurably worse: the extra frame lets another keystroke land in the box
    // that just filled up.
    if (advanceAt && digits.length === advanceAt) next?.current?.focus();
  };

  return (
    <View>
      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
          <View style={styles.accessory}>
            <Micro tone="dim">Birth details</Micro>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done entering birth information"
              hitSlop={12}
              onPress={Keyboard.dismiss}
              style={({ pressed }) => [styles.doneButton, pressed && styles.donePressed]}
            >
              <Type variant="button" tone="onLight">
                Done
              </Type>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}

      <Label>Date of birth</Label>
      <View style={styles.row}>
        <Box value={fields.day} placeholder="DD" maxLength={2} label="Day of birth" onChange={v => set("day", v, 2, monthRef)} />
        <Type variant="h2" tone="faint" style={styles.sep}>/</Type>
        <Box inputRef={monthRef} value={fields.month} placeholder="MM" maxLength={2} label="Month of birth" onChange={v => set("month", v, 2, yearRef)} />
        <Type variant="h2" tone="faint" style={styles.sep}>/</Type>
        <Box inputRef={yearRef} wide value={fields.year} placeholder="YYYY" maxLength={4} label="Year of birth" onChange={v => set("year", v, 4, hourRef)} />
      </View>

      <Label style={styles.secondLabel}>Time of birth</Label>
      <View style={styles.row}>
        <Box inputRef={hourRef} value={fields.hour} placeholder="HH" maxLength={2} label="Hour of birth" onChange={v => set("hour", v, 2, minuteRef)} />
        <Type variant="h2" tone="faint" style={styles.sep}>:</Type>
        <Box inputRef={minuteRef} value={fields.minute} placeholder="MM" maxLength={2} label="Minute of birth" onChange={v => set("minute", v)} />
        <Micro tone="faint" style={styles.hint}>24-hour</Micro>
      </View>

      <BodySm tone="dim" style={styles.why}>
        NOIR calculates your chart from these. Your exact time sets your rising sign, which
        changes every couple of hours — if you only know it roughly, use your best guess.
      </BodySm>
    </View>
  );
}

function Box({
  value,
  placeholder,
  maxLength,
  onChange,
  wide,
  inputRef,
  label,
}: {
  value: string;
  placeholder: string;
  maxLength: number;
  onChange: (value: string) => void;
  wide?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
  label: string;
}) {
  return (
    <TextInput
      ref={inputRef}
      value={value}
      placeholder={placeholder}
      placeholderTextColor={color.textFaint}
      keyboardType="number-pad"
      inputAccessoryViewID={Platform.OS === "ios" ? INPUT_ACCESSORY_ID : undefined}
      returnKeyType="done"
      maxLength={maxLength}
      accessibilityLabel={label}
      maxFontSizeMultiplier={1.3}
      onChangeText={onChange}
      onSubmitEditing={Keyboard.dismiss}
      style={[styles.box, wide && styles.wide]}
    />
  );
}

const styles = StyleSheet.create({
  accessory: {
    minHeight: 52,
    backgroundColor: "#111112",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  doneButton: {
    minWidth: 80,
    minHeight: hit.min - 8,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.textHigh,
    paddingHorizontal: space.lg,
  },
  donePressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
  secondLabel: { marginTop: space.xxl },
  box: {
    width: 72,
    height: 62,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    color: color.textHigh,
    textAlign: "center",
    fontSize: 20,
    fontFamily: font.medium,
  },
  wide: { width: 98 },
  sep: { marginHorizontal: -2 },
  hint: { marginLeft: space.sm },
  why: { marginTop: space.lg, maxWidth: 330 },
});
