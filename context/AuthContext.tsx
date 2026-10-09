import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { NoirUser, onAuthStateChanged } from "../firebase/auth";

type AuthContextType = {
  user: NoirUser | null;
  loading: boolean;
  configured: boolean;
};

// Native Firebase is configured by GoogleService-Info.plist for iOS.
// The app should not gate the account screen on the Web SDK config flag.
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  configured: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<NoirUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      return onAuthStateChanged((current) => {
        setUser(current);
        setLoading(false);
      });
    } catch (error) {
      console.warn("NOIR Firebase Auth is unavailable in this runtime.", error);
      setLoading(false);
      return undefined;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, configured: true }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
