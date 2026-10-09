import { useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { router, usePathname } from "expo-router";
import Type from "./Type";
import { color, hit, radius, space } from "../constants/theme";
import { tapFeedback } from "../services/haptics";

type Tab = {
  label: string;
  path: "/home" | "/daily" | "/journal" | "/sky" | "/profile";
  matches: string[];
};

/**
 * Today and Journal are top-level because they are the reason a subscriber
 * opens the app again tomorrow. Settings stays one level down, reachable from
 * Profile, where people look for it anyway.
 */
const TABS: Tab[] = [
  { label: "Home", path: "/home", matches: ["/home"] },
  { label: "Today", path: "/daily", matches: ["/daily"] },
  { label: "Journal", path: "/journal", matches: ["/journal"] },
  { label: "Sky", path: "/sky", matches: ["/sky", "/object"] },
  { label: "Profile", path: "/profile", matches: ["/profile", "/settings", "/full-reading"] },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <View style={styles.wrap}>
      {TABS.map(tab => (
        <NavTab
          key={tab.path}
          label={tab.label}
          active={tab.matches.includes(pathname)}
          onPress={() => router.push(tab.path)}
        />
      ))}
    </View>
  );
}

function NavTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = (value: number) =>
    Animated.spring(scale, { toValue: value, speed: 32, bounciness: 5, useNativeDriver: true }).start();

  return (
    <Animated.View style={[styles.tabWrap, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        onPress={() => {
          tapFeedback();
          onPress();
        }}
        onPressIn={() => press(0.95)}
        onPressOut={() => press(1)}
        style={[styles.tab, active && styles.activeTab]}
      >
        {/* Sentence case, 12px: the old nav was 8px all-caps with 1.5px tracking. */}
        <Type
          variant="label"
          tone={active ? "onLight" : "muted"}
          numberOfLines={1}
          style={styles.tabText}
        >
          {label}
        </Type>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 60,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: "rgba(11,11,12,0.9)",
    padding: space.xs + 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs / 2,
    zIndex: 10,
  },
  tabWrap: { flex: 1 },
  tab: {
    minHeight: hit.min,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xs,
  },
  activeTab: { backgroundColor: color.textHigh },
  // Five tabs at 375pt leaves ~64pt each; 11px keeps "Journal" and "Profile"
  // on one line without truncating.
  tabText: { fontSize: 11, letterSpacing: 0.2, textTransform: "none" },
});
