"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { getPortalBranding } from "@/lib/portal-branding";

import { LoadingAnimation } from "@/components/ui/LoadingAnimation";

const REMEMBER_KEY = "ap_login_remember_identifier";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, refresh } = useAuth();
  const branding = getPortalBranding();
  const ssoToken = searchParams.get("token");
  const crmFrontendUrl =
    process.env.NEXT_PUBLIC_CRM_FRONTEND_URL || "https://crm.pydah.edu.in";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotHint, setForgotHint] = useState(false);
  const [isVerifyingSso, setIsVerifyingSso] = useState(Boolean(ssoToken));
  const [ssoError, setSsoError] = useState<string | null>(null);
  const hasAttemptedSso = useRef(false);
  /** Avoid SSR/client auth-branch mismatch (loading resolves only on client). */
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setIdentifier(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // Only redirect to dashboard if not processing an incoming SSO token
    if (!hydrated || loading || !user || ssoToken) return;
    router.replace("/dashboard");
  }, [hydrated, loading, user, ssoToken, router]);

  // Ensure portal-switcher.js CDN is loaded to register <pydah-sso-loader />
  useEffect(() => {
    if (!ssoToken || typeof document === "undefined") return;
    const scriptId = "pydah-portal-switcher-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `${crmFrontendUrl}/portal-switcher.js`;
      script.async = true;
      script.setAttribute("data-current-portal", "academic-portal");
      document.body.appendChild(script);
    }
  }, [ssoToken, crmFrontendUrl]);

  useEffect(() => {
    if (!ssoToken || !hydrated || hasAttemptedSso.current) return;
    hasAttemptedSso.current = true;
    let cancelled = false;

    async function handleSSOLogin() {
      setIsVerifyingSso(true);
      setSsoError(null);

      // Section 112: Clear old session so the incoming SSO login takes over cleanly
      try {
        window.localStorage.removeItem("accessToken");
        window.localStorage.removeItem("token");
        window.localStorage.removeItem("user");
        window.localStorage.removeItem("ap_is_sso");
        window.sessionStorage.clear();
      } catch {
        /* ignore */
      }

      try {
        const response = await apiFetch("/auth/sso-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: ssoToken }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof body?.message === "string"
              ? body.message
              : "SSO authentication failed",
          );
        }

        try {
          window.localStorage.setItem("ap_is_sso", "true");
        } catch {
          /* ignore */
        }

        await refresh();
        if (!cancelled) {
          router.replace("/dashboard");
        }
      } catch (err) {
        if (!cancelled) {
          setSsoError(err instanceof Error ? err.message : "SSO authentication failed");
          setIsVerifyingSso(false);
        }
      }
    }

    void handleSSOLogin();

    return () => {
      cancelled = true;
    };
  }, [ssoToken, hydrated, refresh, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setForgotHint(false);
    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body?.message === "string" ? body.message : "Login failed",
        );
      }

      try {
        window.localStorage.removeItem("ap_is_sso");
        if (rememberMe) {
          window.localStorage.setItem(REMEMBER_KEY, identifier.trim());
        } else {
          window.localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* ignore */
      }

      await refresh();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Show universal workspace transition loader while verifying SSO token
  if (isVerifyingSso) {
    return <pydah-sso-loader portal="academic-portal" />;
  }

  // Same markup on server + first client paint; auth UI only after hydrate.
  if (!hydrated || loading || user) {
    return (
      <div className="flex h-full min-h-dvh items-center justify-center bg-[#F3F7FB] text-sm text-slate-500">
        <LoadingAnimation
          label={
            hydrated && user
              ? "Redirecting to Academic Portal…"
              : "Loading Academic Portal…"
          }
          subtitle="Please wait while we verify your session."
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-dvh items-center justify-center overflow-hidden bg-[#F3F7FB] px-3 py-6 sm:px-6">
      {/* Dynamic Backside Animations behind the login card */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 overflow-visible lg:h-[800px] lg:w-[1050px]"
        aria-hidden
      >
        <div className="login-backdrop-halo absolute left-1/2 top-1/2 h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-[#0F2742]/20 via-[#1e40af]/20 to-[#7c3aed]/25 blur-[100px]" />
        <div className="login-orb-float-1 absolute -left-16 -top-12 h-80 w-80 rounded-full bg-[#1e40af]/25 blur-[90px]" />
        <div className="login-orb-float-2 absolute -right-12 -bottom-12 h-96 w-96 rounded-full bg-[#7c3aed]/20 blur-[100px]" />
        <div className="login-orb-float-1 absolute bottom-6 left-1/3 h-72 w-72 rounded-full bg-[#0284c7]/20 blur-[90px]" />
      </div>

      <PwaInstallPrompt />

      <div className="login-illust-enter relative z-10 my-auto grid w-full max-w-[1180px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,39,66,0.12)] lg:min-h-[min(620px,calc(100vh-3rem))] lg:w-[90vw] lg:grid-cols-2">
        {/* Left: education illustration, same card as the form */}
        <div className="relative hidden items-center justify-center overflow-hidden bg-[#0F2742] px-4 py-5 lg:flex xl:px-5 xl:py-6">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="login-orb absolute -left-8 top-12 h-44 w-44 rounded-full bg-[#1e4a7a]/40 blur-2xl" />
            <div className="login-orb-delay absolute -right-6 bottom-16 h-36 w-36 rounded-full bg-[#0d6e6a]/35 blur-2xl" />
            <div className="login-glow absolute bottom-[18%] left-1/2 h-24 w-[70%] -translate-x-1/2 rounded-full bg-[#3b82c4]/25 blur-3xl" />
            <span className="login-spark absolute left-[18%] top-[22%] h-2 w-2 rounded-full bg-[#5ba3e0]/80 shadow-[0_0_10px_rgba(91,163,224,0.8)]" />
            <span className="login-spark-delay absolute right-[22%] top-[28%] h-1.5 w-1.5 rounded-full bg-[#7dd3c0]/70 shadow-[0_0_8px_rgba(125,211,192,0.7)]" />
            <span className="login-spark absolute right-[30%] bottom-[30%] h-1.5 w-1.5 rounded-full bg-[#f4c46a]/65 shadow-[0_0_8px_rgba(244,196,106,0.6)]" />
          </div>
          <div className="relative z-10 flex w-full max-w-[560px] items-center justify-center">
            <div className="login-illust-float w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/illustrations/login-education.png"
                alt="Students learning with analytics and education tools"
                className="mx-auto h-auto w-full max-h-[min(520px,calc(100vh-8rem))] select-none object-contain"
                draggable={false}
              />
            </div>
          </div>
        </div>

        {/* Right: login form */}
        <div className="flex flex-col justify-center bg-white px-6 py-10 sm:px-12 lg:px-14 xl:px-16">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-[180px] items-center justify-center sm:h-[72px] sm:w-[200px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={branding.collegeLogo}
                  alt={`${branding.collegeName} logo`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <h1 className="mt-3 text-lg font-semibold tracking-tight text-navy-900 sm:text-xl">
                {branding.collegeName}
              </h1>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {branding.portalName}
              </p>
            </div>

            {ssoError ? (
              <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800 shadow-sm">
                <p className="font-semibold text-rose-900">Single Sign-On Failed</p>
                <p className="mt-1 leading-relaxed text-rose-700">{ssoError}</p>
                <div className="mt-2.5 flex items-center gap-3">
                  {crmFrontendUrl ? (
                    <a
                      href={crmFrontendUrl}
                      className="font-medium text-navy-900 underline transition hover:text-navy-950"
                    >
                      Return to CRM Portal
                    </a>
                  ) : null}
                  <span className="text-slate-400">or sign in with credentials below</span>
                </div>
              </div>
            ) : null}

            <form className="mt-8 space-y-4" onSubmit={onSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">
                  Email / Employee ID
                </span>
                <input
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="HRMS email or employee id"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 text-sm text-navy-900 outline-none transition placeholder:text-slate-400 focus:border-navy-800 focus:bg-white focus:ring-2 focus:ring-navy-800/10"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">
                  Password
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your HRMS password"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-3.5 pr-10 text-sm text-navy-900 outline-none transition placeholder:text-slate-400 focus:border-navy-800 focus:bg-white focus:ring-2 focus:ring-navy-800/10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-navy-900"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-navy-900 focus:ring-navy-800/30"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-navy-800 hover:underline"
                  onClick={() => setForgotHint(true)}
                >
                  Forgot Password?
                </button>
              </div>

              {forgotHint ? (
                <p className="text-xs text-slate-500">
                  Change or reset your password in HRMS. This portal always uses your current HRMS
                  password — it is never stored here. Contact your administrator if you need portal
                  access first.
                </p>
              ) : null}

              {error ? <p className="text-sm text-critical">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting || !identifier || !password}
                className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-navy-900 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:opacity-100 disabled:shadow-none disabled:hover:bg-slate-300"
              >
                {submitting ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
