import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CosmicBackground from "../components/CosmicBackground";
import NoirButton from "../components/NoirButton";
import { BodySm, Display, Micro } from "../components/Type";
import { color, space } from "../constants/theme";

export default function NotFound() {
  return (
    <SafeAreaView style={styles.safe}>
      <CosmicBackground faint />
      <View style={styles.center}>
        <Micro>NOIR / Off the map</Micro>
        <Display center style={styles.title}>
          There's nothing here.
        </Display>
        <BodySm center style={styles.sub}>
          That screen doesn't exist. Let's get you back.
        </BodySm>
        <View style={styles.actions}>
          <NoirButton label="Back to NOIR" filled onPress={() => router.replace("/")} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
  title: { marginTop: space.md },
  sub: { marginTop: space.md },
  actions: { marginTop: space.xxxl, alignSelf: "stretch" },
});
