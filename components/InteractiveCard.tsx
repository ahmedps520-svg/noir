import type { ReactNode } from "react";
import Card from "./Card";

/**
 * Kept as an alias so any older import keeps working.
 *
 * The press-scale behaviour this used to own now lives in Card, together with
 * the shared surface treatment — having two card implementations was how the
 * app ended up with five different border radii for the same visual object.
 * Prefer importing Card directly in new code.
 */
export default function InteractiveCard({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} padded={false}>
      {children}
    </Card>
  );
}
