"use client";

import * as React from "react";
import { useEffect } from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Authorization } from "@/components/auth/AuthProvider";

declare global {
  interface Window {
    process?: {
      env?: Record<string, string | undefined>;
    };
    React?: typeof React;
    ReactDOM?: typeof ReactDOM & {
      createRoot?: typeof ReactDOMClient.createRoot;
      hydrateRoot?: typeof ReactDOMClient.hydrateRoot;
    };
    NEMO_AI_API_URL?: string;
    PYDAH_AI_API_URL?: string;
    NEMO_AI_AUTH_TOKEN?: string;
    PYDAH_AI_AUTH_TOKEN?: string;
    NEMO_AI_ASSISTANT_ID?: string;
    PYDAH_AI_ASSISTANT_ID?: string;
    NEMO_AI_TITLE?: string;
    PYDAH_AI_TITLE?: string;
    NEMO_AI_MODE?: string;
    PYDAH_AI_MODE?: string;
    NEMO_AI_SERVICE_URL?: string;
    PYDAH_AI_SERVICE_URL?: string;
    NEMO_SERVICE_URL?: string;
    PORTAL_BACKEND_URL?: string;
    APPLICATION_SERVICE_URL?: string;
    NemoAIChatWidget?: React.ComponentType<{
      apiBaseUrl?: string | null;
      serviceUrl?: string | null;
      backendUrl?: string | null;
      portalUrl?: string | null;
      assistantId?: string;
      authToken?: string | null;
      title?: string | null;
      mode?: string;
    }>;
    PydahAIChatWidget?: React.ComponentType<{
      apiBaseUrl?: string | null;
      serviceUrl?: string | null;
      backendUrl?: string | null;
      portalUrl?: string | null;
      assistantId?: string;
      authToken?: string | null;
      title?: string | null;
      mode?: string;
    }>;
  }
}

// Polyfill Node.js globals & initialize Nemo window configuration immediately
if (typeof window !== "undefined") {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_BACKEND_URL ||
    process.env.NEXT_PUBLIC_NEMO_AI_SERVICE_URL ||
    (isLocal ? "http://localhost:4000" : "https://acad.pydah.edu.in");
  const nemoApi =
    process.env.NEXT_PUBLIC_NEMO_AI_API_URL ||
    (isLocal ? "http://localhost:8000" : "https://nemo-ai.pydah.edu.in");

  window.process = window.process || {
    env: { NODE_ENV: "production" },
  };
  if (window.process.env) {
    window.process.env.NEXT_PUBLIC_NEMO_AI_SERVICE_URL = portalUrl;
    window.process.env.NEXT_PUBLIC_PORTAL_BACKEND_URL = portalUrl;
    window.process.env.APPLICATION_SERVICE_URL = portalUrl;
  }
  window.React = React;
  window.ReactDOM = {
    ...ReactDOM,
    createRoot: ReactDOMClient.createRoot,
    hydrateRoot: ReactDOMClient.hydrateRoot,
  };
  window.NEMO_AI_SERVICE_URL = portalUrl;
  window.NEMO_SERVICE_URL = portalUrl;
  window.PORTAL_BACKEND_URL = portalUrl;
  window.APPLICATION_SERVICE_URL = portalUrl;
  window.PYDAH_AI_SERVICE_URL = portalUrl;
  window.NEMO_AI_API_URL = nemoApi;
  window.PYDAH_AI_API_URL = nemoApi;
  window.NEMO_AI_ASSISTANT_ID = "portal-assistant";
  window.PYDAH_AI_ASSISTANT_ID = "portal-assistant";
}

/**
 * Resolve the Nemo AI backend endpoint.
 * In local testing / development, defaults strictly to http://localhost:8000.
 */
function resolveNemoApiUrl(): string {
  if (process.env.NEXT_PUBLIC_NEMO_AI_API_URL) {
    return process.env.NEXT_PUBLIC_NEMO_AI_API_URL;
  }
  if (typeof window !== "undefined") {
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocal) {
      return "http://localhost:8000";
    }
  }
  return process.env.NODE_ENV === "production"
    ? "https://nemo-ai.pydah.edu.in"
    : "http://localhost:8000";
}

/**
 * Resolve the Academic Portal host backend service URL.
 * Nemo AI engine calls this host URL to discover /ai-tools and dispatch /execute-tool.
 * In local testing / development, defaults strictly to http://localhost:4000.
 */
function resolvePortalServiceUrl(): string {
  if (process.env.NEXT_PUBLIC_PORTAL_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_PORTAL_BACKEND_URL;
  }
  if (process.env.NEXT_PUBLIC_NEMO_AI_SERVICE_URL) {
    return process.env.NEXT_PUBLIC_NEMO_AI_SERVICE_URL;
  }
  if (typeof window !== "undefined") {
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocal) {
      return "http://localhost:4000";
    }
  }
  return process.env.NODE_ENV === "production"
    ? "https://acad.pydah.edu.in"
    : "http://localhost:4000";
}

const DEFAULT_NEMO_CDN_URL =
  process.env.NEXT_PUBLIC_NEMO_CDN_URL || "https://nemo-chat.pydah.edu.in";

/**
 * Checks if the user is a Super Admin or Global Administrator.
 */
function isUserSuperAdmin(authz: Authorization | null): boolean {
  if (!authz?.roles?.length) return false;
  return authz.roles.some((r) => {
    const key = (r.roleKey || "").toLowerCase();
    const label = (r.label || "").toLowerCase();
    return (
      key === "super_admin" ||
      key === "superadmin" ||
      label.includes("super admin") ||
      Boolean(authz.scope?.isGlobal && key.includes("admin"))
    );
  });
}

/**
 * Scopes raw CSS string so every rule applies strictly within scopeSelector.
 * Prevents Tailwind preflight resets (button, input, body, *) from leaking into
 * the host application and modifying existing portal UI.
 */
function scopeCss(css: string, scopeSelector: string): string {
  let out = "";
  let i = 0;

  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i]!)) i++;
    if (i >= css.length) break;

    if (css[i] === "@") {
      const atStart = i;
      while (i < css.length && css[i] !== "{" && css[i] !== ";") i++;
      const atRule = css.slice(atStart, i).trim();

      if (css[i] === ";") {
        out += atRule + ";\n";
        i++;
        continue;
      }

      if (css[i] === "{") {
        i++; // skip '{'
        if (
          atRule.startsWith("@keyframes") ||
          atRule.startsWith("@-webkit-keyframes") ||
          atRule.startsWith("@font-face")
        ) {
          const bodyStart = i;
          let depth = 1;
          while (i < css.length && depth > 0) {
            if (css[i] === "{") depth++;
            else if (css[i] === "}") depth--;
            i++;
          }
          out += `${atRule} { ${css.slice(bodyStart, i - 1)} }\n`;
        } else {
          let innerCss = "";
          let depth = 1;
          const innerStart = i;
          while (i < css.length && depth > 0) {
            if (css[i] === "{") depth++;
            else if (css[i] === "}") depth--;
            i++;
          }
          innerCss = css.slice(innerStart, i - 1);
          out += `${atRule} {\n${scopeCss(innerCss, scopeSelector)}\n}\n`;
        }
        continue;
      }
    }

    const selStart = i;
    while (i < css.length && css[i] !== "{") i++;
    const rawSelector = css.slice(selStart, i).trim();
    if (css[i] === "{") i++;

    const declStart = i;
    let depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    const decls = css.slice(declStart, i - 1);

    const scopedSelectors = rawSelector
      .split(",")
      .map((s) => {
        const trimmed = s.trim();
        if (!trimmed) return "";
        if (trimmed === "html" || trimmed === "body" || trimmed === ":root") {
          return scopeSelector;
        }
        if (
          trimmed.startsWith("html") ||
          trimmed.startsWith("body") ||
          trimmed.startsWith(":root")
        ) {
          return `${scopeSelector} ${trimmed.replace(/^(?:html|body|:root)\s*/, "")}`.trim();
        }
        if (trimmed === "*" || trimmed === ":before" || trimmed === ":after") {
          return `${scopeSelector} ${trimmed}`;
        }
        return `${scopeSelector} ${trimmed}`;
      })
      .filter(Boolean)
      .join(", ");

    if (scopedSelectors) {
      out += `${scopedSelectors} { ${decls} }\n`;
    }
  }

  return out;
}

export function NemoChatWidget() {
  const { authorization, token } = useAuth();
  const isSuperAdmin = isUserSuperAdmin(authorization);

  useEffect(() => {
    if (!isSuperAdmin) return;

    let isCancelled = false;
    const styleId = "nemo-ai-scoped-style";
    const scriptId = "nemo-ai-script";
    const cdnBase = DEFAULT_NEMO_CDN_URL.replace(/\/$/, "");
    const nemoApiUrl = resolveNemoApiUrl();
    const portalServiceUrl = resolvePortalServiceUrl();

    // Ensure globals exist for UMD bundle
    if (typeof window !== "undefined") {
      window.process = window.process || {
        env: { NODE_ENV: "production" },
      };
      if (window.process.env) {
        window.process.env.NEXT_PUBLIC_NEMO_AI_SERVICE_URL = portalServiceUrl;
        window.process.env.NEXT_PUBLIC_PORTAL_BACKEND_URL = portalServiceUrl;
        window.process.env.APPLICATION_SERVICE_URL = portalServiceUrl;
      }
      window.React = React;
      window.ReactDOM = {
        ...ReactDOM,
        createRoot: ReactDOMClient.createRoot,
        hydrateRoot: ReactDOMClient.hydrateRoot,
      };
    }

    const authToken =
      token ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem("ap_token") || ""
        : "");

    // 1. Configure Nemo & Pydah AI window globals for testing / production
    window.NEMO_AI_API_URL = nemoApiUrl;
    window.PYDAH_AI_API_URL = nemoApiUrl;
    window.NEMO_AI_SERVICE_URL = portalServiceUrl;
    window.PYDAH_AI_SERVICE_URL = portalServiceUrl;
    window.NEMO_SERVICE_URL = portalServiceUrl;
    window.PORTAL_BACKEND_URL = portalServiceUrl;
    window.APPLICATION_SERVICE_URL = portalServiceUrl;
    window.NEMO_AI_AUTH_TOKEN = authToken;
    window.PYDAH_AI_AUTH_TOKEN = authToken;
    window.NEMO_AI_ASSISTANT_ID = "portal-assistant";
    window.PYDAH_AI_ASSISTANT_ID = "portal-assistant";
    window.NEMO_AI_TITLE = "Nemo (Super Admin)";
    window.PYDAH_AI_TITLE = "Nemo (Super Admin)";
    window.NEMO_AI_MODE = "widget";
    window.PYDAH_AI_MODE = "widget";

    // Helper to manually mount widget if auto-mount didn't trigger
    const tryMountWidget = () => {
      if (typeof window === "undefined" || isCancelled) return;
      if (document.getElementById("nemo-ai-chat-root")) return;

      const WidgetComp = window.NemoAIChatWidget || window.PydahAIChatWidget;
      if (WidgetComp) {
        const container = document.createElement("div");
        container.id = "nemo-ai-chat-root";
        container.className = "nemo-ai-root";
        document.body.appendChild(container);

        try {
          const root = ReactDOMClient.createRoot(container);
          root.render(
            React.createElement(WidgetComp, {
              apiBaseUrl: nemoApiUrl,
              serviceUrl: portalServiceUrl,
              backendUrl: portalServiceUrl,
              portalUrl: portalServiceUrl,
              assistantId: "portal-assistant",
              authToken: authToken,
              title: "Nemo (Super Admin)",
              mode: "widget",
            }),
          );
        } catch (err) {
          console.warn("[NemoAI] Manual mount error:", err);
        }
      }
    };

    // 2. Fetch style.css and inject strictly scoped to #nemo-ai-chat-root
    if (!document.getElementById(styleId)) {
      fetch(`${cdnBase}/style.css`)
        .then((res) => res.text())
        .then((css) => {
          if (isCancelled) return;
          if (document.getElementById(styleId)) return;
          const scoped = scopeCss(css, "#nemo-ai-chat-root");
          const styleEl = document.createElement("style");
          styleEl.id = styleId;
          styleEl.textContent = scoped;
          document.head.appendChild(styleEl);
        })
        .catch(() => {
          // If fetch fails, do not inject un-scoped styles
        });
    }

    // 3. If widget bundle is already loaded in memory, mount directly
    if (window.NemoAIChatWidget || window.PydahAIChatWidget) {
      tryMountWidget();
    } else if (!document.getElementById(scriptId)) {
      // 4. Inject UMD bundle script
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `${cdnBase}/index.umd.js`;
      script.async = true;
      script.onload = () => {
        // In case UMD auto-mount didn't run, execute fallback
        setTimeout(tryMountWidget, 50);
      };
      document.body.appendChild(script);
    }

    return () => {
      isCancelled = true;
      // Cleanup DOM on unmount if user navigates away from superadmin dashboard
      const root = document.getElementById("nemo-ai-chat-root");
      if (root) {
        root.remove();
      }
      const styleEl = document.getElementById(styleId);
      if (styleEl) {
        styleEl.remove();
      }
      const scriptEl = document.getElementById(scriptId);
      if (scriptEl) {
        scriptEl.remove();
      }
    };
  }, [isSuperAdmin, token]);

  if (!isSuperAdmin) {
    return null;
  }

  return null;
}
