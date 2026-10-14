"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, X } from "lucide-react";
import { useAuth } from "./AuthProvider";

type LogoutConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => Promise<void> | void;
};

export function LogoutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
}: LogoutConfirmModalProps) {
  const { isSso, crmUrl, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsLoggingOut(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoggingOut) {
        onClose();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isLoggingOut, onClose]);

  if (!isOpen || !mounted || typeof document === "undefined") {
    return null;
  }

  const handleConfirm = async () => {
    try {
      setIsLoggingOut(true);
      if (onConfirm) {
        await onConfirm();
      } else {
        await logout();
      }
    } catch (err) {
      console.error("Logout error:", err);
      // Fallback in case of unexpected error
      if (isSso && crmUrl) {
        window.location.replace(crmUrl);
      } else {
        window.location.replace("/login");
      }
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={() => {
          if (!isLoggingOut) onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className="relative z-[101] mx-auto w-full max-w-[350px] sm:max-w-md overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-2xl transition-all duration-200 animate-in fade-in-0 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          disabled={isLoggingOut}
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-3.5 top-3.5 sm:right-4 sm:top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Visual Icon Badge */}
          <div className="mx-auto mb-3.5 sm:mb-4 flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-rose-50 ring-8 ring-rose-50/60">
            <LogOut className="h-6 w-6 text-rose-600" />
          </div>

          {/* Title */}
          <h3
            id="logout-modal-title"
            className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight"
          >
            Confirm Sign Out
          </h3>

          {/* Description & SSO Context */}
          <div className="mt-2.5 w-full text-xs sm:text-sm text-slate-600">
            {isSso ? (
              <div className="space-y-3">
                <p className="leading-relaxed text-slate-700">
                  Are you sure you want to sign out of the <span className="font-semibold text-slate-900">Academic Portal</span>?
                </p>

                {/* SSO Info Callout */}
                <div className="rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/60 p-3 sm:p-3.5 text-center shadow-2xs">
                  <p className="text-xs sm:text-sm font-medium text-amber-900">
                    By logging out you will be redirected to CRM portal
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 py-1">
                <p className="leading-relaxed text-slate-700">
                  Are you sure you want to sign out of your account?
                </p>
                <p className="text-xs text-slate-500">
                  You will need to sign in again to access the Academic Portal.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-5 sm:mt-6 w-full grid grid-cols-2 gap-2.5 sm:flex sm:items-center sm:justify-center sm:gap-3">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={onClose}
              className="h-11 w-full sm:w-auto sm:min-w-[120px] inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-3 sm:px-5 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300 active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleConfirm}
              className="h-11 w-full sm:w-auto sm:min-w-[130px] inline-flex cursor-pointer items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-3 sm:px-5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-red-600/20 transition hover:from-red-700 hover:to-rose-700 focus:outline-none focus:ring-2 focus:ring-red-500 active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
            >
              {isLoggingOut ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin text-white shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="truncate">
                    {isSso ? "Redirecting..." : "Signing out..."}
                  </span>
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Sign Out</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
