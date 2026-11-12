"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { AcademicProvider } from "@/components/layout/AcademicProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

declare global {
  interface Window {
    ThemeLoader?: {
      init?: (options?: { themeServer?: string; pollInterval?: number }) => unknown;
      checkNow?: (callback?: () => void) => void;
      getVersion?: () => string | null;
      getToken?: (tokenName: string) => string;
      getTokens?: () => Record<string, string>;
    };
  }
}

const COLLAPSE_KEY = "ap.sidebar.collapsed";
const PORTAL_THEME_ATTR = "data-portal-theme";
const THEME_LOADER_SCRIPT_ID = "central-theme-loader";
const THEME_FALLBACK_LINK_ID = "central-theme-css-fallback";
const THEME_STYLE_IDS = ["app-theme-cached", "app-theme-active", "app-theme-fallback"];
const THEME_STORAGE_CSS_KEY = "app_theme_css";

function resolveThemeServerConfig(): { serverUrl: string; pollInterval: number } {
  const configured = process.env.NEXT_PUBLIC_THEME_SERVER_URL?.trim();
  const isLocalHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (configured) {
    return {
      serverUrl: configured.replace(/\/+$/, ""),
      pollInterval: isLocalHost ? 10 : 30,
    };
  }

  if (isLocalHost) {
    return { serverUrl: "http://localhost:7000", pollInterval: 10 };
  }

  return process.env.NODE_ENV === "production"
    ? { serverUrl: "https://ui-theme.pydah.edu.in", pollInterval: 30 }
    : { serverUrl: "http://localhost:7000", pollInterval: 10 };
}

function applyCachedPortalTheme() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    const cachedCss = window.localStorage.getItem(THEME_STORAGE_CSS_KEY);
    if (!cachedCss) return;
    const formatted = cachedCss.replace(/:root\b/g, ":root, :root:root");
    const target = document.head || document.documentElement;
    if (!target) return;
    let style = document.getElementById("app-theme-cached") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "app-theme-cached";
      target.appendChild(style);
    }
    style.textContent = formatted;
  } catch {
    /* ignore */
  }
}

function clearPortalThemeNodes() {
  if (typeof document === "undefined") return;
  document.getElementById(THEME_FALLBACK_LINK_ID)?.remove();
  for (const id of THEME_STYLE_IDS) {
    document.getElementById(id)?.remove();
  }
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute(PORTAL_THEME_ATTR, "true");
    applyCachedPortalTheme();

    return () => {
      root.removeAttribute(PORTAL_THEME_ATTR);
      clearPortalThemeNodes();
    };
  }, []);

  useEffect(() => {
    const { serverUrl, pollInterval } = resolveThemeServerConfig();
    const head = document.head || document.documentElement;

    if (!document.getElementById(THEME_FALLBACK_LINK_ID)) {
      const link = document.createElement("link");
      link.id = THEME_FALLBACK_LINK_ID;
      link.rel = "stylesheet";
      link.href = `${serverUrl}/themes/theme.css`;
      head.appendChild(link);
    }

    let script = document.getElementById(THEME_LOADER_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = THEME_LOADER_SCRIPT_ID;
      script.src = `${serverUrl}/themes/theme-loader.js`;
      script.async = false;
      script.setAttribute("data-theme-server", serverUrl);
      script.setAttribute("data-poll-interval", String(pollInterval));
      script.onload = () => {
        if (window.ThemeLoader?.init) {
          window.ThemeLoader.init({ themeServer: serverUrl, pollInterval });
        }
      };
      head.appendChild(script);
    } else if (window.ThemeLoader?.checkNow) {
      applyCachedPortalTheme();
      window.ThemeLoader.checkNow();
    }

    let lastFocusCheck = 0;
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastFocusCheck < 2000) return;
      lastFocusCheck = now;
      if (window.ThemeLoader?.checkNow) {
        window.ThemeLoader.checkNow();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <AcademicProvider>
      <div className="flex h-dvh max-h-dvh overflow-hidden bg-background print:h-auto print:max-h-none print:overflow-visible print:bg-white">
        <div className="print:hidden">
          <Sidebar
            open={mobileOpen}
            collapsed={collapsed}
            onClose={() => setMobileOpen(false)}
            onToggleCollapsed={toggleCollapsed}
          />
        </div>
        <div
          className={`flex min-h-0 min-w-0 flex-1 flex-col transition-[padding] duration-200 print:block print:min-h-full print:pl-0 ${
            collapsed ? "lg:pl-20" : "lg:pl-64"
          }`}
        >
          <div className="print:hidden">
            <TopHeader onMenuClick={() => setMobileOpen(true)} />
          </div>
          <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3.5 pb-24 sm:px-5 sm:py-5 sm:pb-[max(1rem,env(safe-area-inset-bottom))] print:block print:overflow-visible print:p-0">
            {children}
          </main>
          <MobileBottomNav onMenuClick={() => setMobileOpen(true)} />
        </div>
      </div>
    </AcademicProvider>
  );
}
