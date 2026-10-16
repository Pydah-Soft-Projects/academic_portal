"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const SSO_STORAGE_KEY = "ap_is_sso";
const DEFAULT_CRM_URL =
  process.env.NEXT_PUBLIC_CRM_FRONTEND_URL || "https://crm.pydah.edu.in";

export type AuthUser = {
  id: number;
  name: string;
  email: string | null;
  username: string;
  hrmsEmployeeId: string | null;
  hrmsUserId: string;
  profilePhoto?: string | null;
  loginMethod?: string;
  isSso?: boolean;
};

export type AuthRole = {
  roleKey: string;
  label: string;
  collegeId: number | null;
  branchId: number | null;
};

export type AuthScope = {
  isGlobal: boolean;
  collegeIds: number[] | null;
  branchIds: number[] | null;
};

export type Authorization = {
  roles: AuthRole[];
  permissions: string[];
  scope: AuthScope;
};

type AuthContextValue = {
  user: AuthUser | null;
  authorization: Authorization | null;
  loading: boolean;
  isSso: boolean;
  crmUrl: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (...permissions: string[]) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_AUTHZ: Authorization = {
  roles: [],
  permissions: [],
  scope: { isGlobal: false, collegeIds: [], branchIds: [] },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSso, setIsSso] = useState(false);
  const [crmUrl, setCrmUrl] = useState(DEFAULT_CRM_URL);
  const router = useRouter();

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const incomingToken = urlParams.get("token");
      if (incomingToken) {
        // Clear old session so incoming SSO login takes over cleanly
        window.localStorage.removeItem("accessToken");
        window.localStorage.removeItem("token");
        window.localStorage.removeItem("user");
        window.localStorage.removeItem(SSO_STORAGE_KEY);
        window.sessionStorage.clear();
      } else {
        const stored = window.localStorage.getItem(SSO_STORAGE_KEY);
        if (stored === "true") {
          setIsSso(true);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch("/auth/me");
      if (response.status === 401) {
        setUser(null);
        setAuthorization(null);
        return;
      }
      if (!response.ok) {
        setUser(null);
        setAuthorization(null);
        return;
      }
      const body = (await response.json()) as {
        user: AuthUser;
        authorization?: Authorization;
        crmFrontendUrl?: string;
      };
      setUser(body.user);
      setAuthorization(body.authorization ?? EMPTY_AUTHZ);
      if (body.crmFrontendUrl) {
        setCrmUrl(body.crmFrontendUrl);
      }
      const ssoActive = Boolean(body.user?.isSso || body.user?.loginMethod === "sso");
      setIsSso(ssoActive);
      try {
        if (ssoActive) {
          window.localStorage.setItem(SSO_STORAGE_KEY, "true");
        } else {
          window.localStorage.removeItem(SSO_STORAGE_KEY);
        }
      } catch {
        /* ignore */
      }
    } catch {
      setUser(null);
      setAuthorization(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    let ssoActive = isSso;
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(SSO_STORAGE_KEY) === "true") {
        ssoActive = true;
      }
    } catch {
      /* ignore */
    }

    let backendCrmUrl = crmUrl;
    try {
      const res = await apiFetch("/auth/logout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (typeof data?.isSso === "boolean") {
        ssoActive = ssoActive || data.isSso;
      }
      if (typeof data?.crmFrontendUrl === "string" && data.crmFrontendUrl) {
        backendCrmUrl = data.crmFrontendUrl;
      }
    } catch {
      /* proceed with client-side cleanup */
    } finally {
      try {
        window.localStorage.removeItem(SSO_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setUser(null);
      setAuthorization(null);
      setIsSso(false);

      if (ssoActive) {
        const target = backendCrmUrl || DEFAULT_CRM_URL;
        window.location.replace(target);
      } else {
        router.replace("/login");
      }
    }
  }, [isSso, crmUrl, router]);

  const hasAnyPermission = useCallback(
    (...permissions: string[]) => {
      if (!authorization?.permissions?.length) return false;
      return permissions.some((p) => authorization.permissions.includes(p));
    },
    [authorization],
  );

  const hasPermission = useCallback(
    (...permissions: string[]) => {
      if (!authorization?.permissions?.length) return false;
      return permissions.every((p) => authorization.permissions.includes(p));
    },
    [authorization],
  );

  const value = useMemo(
    () => ({
      user,
      authorization,
      loading,
      isSso,
      crmUrl,
      refresh,
      logout,
      hasPermission,
      hasAnyPermission,
    }),
    [user, authorization, loading, isSso, crmUrl, refresh, logout, hasPermission, hasAnyPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
