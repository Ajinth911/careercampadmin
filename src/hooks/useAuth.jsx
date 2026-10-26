import { useState, useEffect, createContext, useContext } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const AuthContext = createContext(null);

const LOCAL_STORAGE_ADMIN_KEY = "clp_admin_session";

export function AuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initSession() {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Check admin profile
          const { data: profile } = await supabase
            .from("admin_profiles")
            .select("*")
            .eq("id", session.user.id)
            .eq("is_active", true)
            .single();

          if (profile) {
            setAdminUser({
              id: session.user.id,
              email: session.user.email,
              role: profile.role,
              fullName: profile.full_name || "Administrator",
            });
          }
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            const { data: profile } = await supabase
              .from("admin_profiles")
              .select("*")
              .eq("id", session.user.id)
              .eq("is_active", true)
              .single();

            if (profile) {
              setAdminUser({
                id: session.user.id,
                email: session.user.email,
                role: profile.role,
                fullName: profile.full_name || "Administrator",
              });
            } else {
              setAdminUser(null);
            }
          } else {
            setAdminUser(null);
          }
        });

        setLoading(false);
        return () => subscription.unsubscribe();
      } else {
        // Local storage session for dev
        const saved = localStorage.getItem(LOCAL_STORAGE_ADMIN_KEY);
        if (saved) {
          try {
            setAdminUser(JSON.parse(saved));
          } catch {
            localStorage.removeItem(LOCAL_STORAGE_ADMIN_KEY);
          }
        }
        setLoading(false);
      }
    }

    initSession();
  }, []);

  const login = async (email, password) => {
    const isDev = Boolean(import.meta.env.DEV);
    const isDemoAccount = isDev && email.trim() === "admin@careerlaunchpad.com" && password === "Admin@123";

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          throw new Error(error.message || "Invalid administrator credentials.");
        }

        if (data?.user) {
          // Verify administrator role against trusted database records
          const { data: profile, error: profileErr } = await supabase
            .from("admin_profiles")
            .select("*")
            .eq("id", data.user.id)
            .eq("is_active", true)
            .single();

          if (profileErr || !profile) {
            await supabase.auth.signOut();
            throw new Error("Access denied. Your account is not authorized as an active administrator.");
          }

          const adminObj = {
            id: data.user.id,
            email: data.user.email,
            role: profile.role || "admin",
            fullName: profile.full_name || "System Administrator",
          };
          setAdminUser(adminObj);
          return adminObj;
        }

        throw new Error("Invalid administrator credentials.");
      } catch (err) {
        // In development mode, allow the default demo admin fallback
        if (isDemoAccount) {
          const adminObj = {
            id: "local-admin-uuid-001",
            email: "admin@careerlaunchpad.com",
            role: "superadmin",
            fullName: "System Administrator (Dev)",
          };
          setAdminUser(adminObj);
          localStorage.setItem(LOCAL_STORAGE_ADMIN_KEY, JSON.stringify(adminObj));
          return adminObj;
        }
        throw err;
      }
    }

    // Offline development fallback when Supabase is not configured
    if (isDemoAccount) {
      const adminObj = {
        id: "local-admin-uuid-001",
        email: "admin@careerlaunchpad.com",
        role: "superadmin",
        fullName: "System Administrator (Offline Dev)",
      };
      setAdminUser(adminObj);
      localStorage.setItem(LOCAL_STORAGE_ADMIN_KEY, JSON.stringify(adminObj));
      return adminObj;
    }

    throw new Error("Invalid administrator credentials.");
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setAdminUser(null);
    localStorage.removeItem(LOCAL_STORAGE_ADMIN_KEY);
  };

  return (
    <AuthContext.Provider value={{ adminUser, isAuthenticated: Boolean(adminUser), loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
