"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

declare global {
  interface Window {
    PydahSwitcher?: {
      init: (config: {
        currentPortal: string;
        apiBaseUrl?: string;
        landingUrl?: string;
        position?: "bottom-right" | "bottom-left";
        token?: string;
        user?: unknown;
      }) => void;
      destroy?: () => void;
    };
  }
}

const SWITCHER_SCRIPT_ID = "pydah-portal-switcher-script";
const CURRENT_PORTAL_ID = "academic-portal";

/**
 * Pydah Universal Portal Switcher Widget.
 *
 * Strictly rendered ONLY for SSO authenticated users as per integration guide:
 * - When an SSO user is authenticated, dynamically loads and initializes the CDN widget.
 * - When a non-SSO user is logged in, or on logout, tears down the script and removes
 *   all switcher elements from the DOM so non-SSO users never see or interact with it.
 */
export function PortalSwitcher() {
  const { user, isSso, crmUrl } = useAuth();

  const isSsoUser = Boolean(
    user &&
      (isSso ||
        user.isSso ||
        user.loginMethod === "sso" ||
        (typeof window !== "undefined" &&
          window.localStorage.getItem("ap_is_sso") === "true"))
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    function cleanupWidget() {
      try {
        if (window.PydahSwitcher?.destroy) {
          window.PydahSwitcher.destroy();
        }
      } catch {
        /* ignore */
      }
      const hasSsoToken =
        typeof window !== "undefined" &&
        Boolean(new URLSearchParams(window.location.search).get("token"));
      if (!hasSsoToken) {
        const existingScript = document.getElementById(SWITCHER_SCRIPT_ID);
        if (existingScript) {
          existingScript.remove();
        }
      }
      const elements = document.querySelectorAll(
        "pydah-portal-switcher, #pydah-portal-switcher, [data-pydah-switcher], .pydah-portal-switcher"
      );
      elements.forEach((el) => el.remove());
    }

    if (!isSsoUser) {
      cleanupWidget();
      return;
    }

    const crmFrontend = (
      crmUrl ||
      process.env.NEXT_PUBLIC_CRM_FRONTEND_URL ||
      "https://crm.pydah.edu.in"
    ).replace(/\/+$/, "");

    const crmBackend = (
      process.env.NEXT_PUBLIC_CRM_BACKEND_URL ||
      "https://pydah-crm-backend.pydah.edu.in"
    ).replace(/\/+$/, "");

    const scriptSrc = `${crmFrontend}/portal-switcher.js`;

    function initializeSwitcher() {
      if (window.PydahSwitcher?.init) {
        window.PydahSwitcher.init({
          currentPortal: CURRENT_PORTAL_ID,
          apiBaseUrl: crmBackend,
          landingUrl: crmFrontend,
          position: "bottom-right",
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                hrmsEmployeeId: user.hrmsEmployeeId,
                isSso: true,
              }
            : undefined,
        });
      }
    }

    let script = document.getElementById(SWITCHER_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SWITCHER_SCRIPT_ID;
      script.src = scriptSrc;
      script.async = true;
      script.setAttribute("data-current-portal", CURRENT_PORTAL_ID);
      script.setAttribute("data-api-base-url", crmBackend);
      script.setAttribute("data-landing-url", crmFrontend);
      script.setAttribute("data-position", "bottom-right");
      script.addEventListener("load", initializeSwitcher);
      document.body.appendChild(script);
    } else {
      initializeSwitcher();
    }

    // Interval fallback in case script is already loaded/cached
    const timer = setInterval(() => {
      if (window.PydahSwitcher?.init) {
        initializeSwitcher();
        clearInterval(timer);
      }
    }, 300);

    const timeout = setTimeout(() => {
      clearInterval(timer);
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
      if (!isSsoUser) {
        cleanupWidget();
      }
    };
  }, [isSsoUser, user, crmUrl]);

  return null;
}
