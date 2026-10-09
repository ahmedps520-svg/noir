import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

/**
 * Apple's own button component, which App Review requires for Sign in with
 * Apple. Renders nothing on devices where Apple sign-in is unavailable.
 *
 * The Expo Go preview project swaps this file for a plain styled button, which
 * is why the Apple dependency is isolated here rather than in the screens.
 */
export default function AppleSignInButton({
  type = "continue",
  onPress,
}: {
  type?: "continue" | "signIn";
  onPress: () => void;
}) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    AppleAuthentication.isAvailableAsync()
      .then(result => alive && setAvailable(result))
      .catch(() => alive && setAvailable(false));
    return () => {
      alive = false;
    };
  }, []);

  if (!available) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={
        type === "signIn"
          ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
      }
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={29}
      style={styles.button}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  button: { height: 58, width: "100%" },
});
