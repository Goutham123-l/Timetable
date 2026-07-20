import React, { createContext, useCallback, useContext, useState } from "react";

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: Toast["type"], message: string) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const value: ToastContextType = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg shadow-lg border p-3 flex items-start gap-2 text-sm animate-[fadeIn_0.2s_ease-out] ${
              t.type === "success"
                ? "bg-green-50 border-green-300 text-green-800"
                : t.type === "error"
                ? "bg-red-50 border-red-300 text-red-800"
                : "bg-slate-50 border-slate-300 text-slate-700"
            }`}
          >
            <span
              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold ${
                t.type === "success" ? "bg-green-500" : t.type === "error" ? "bg-red-500" : "bg-slate-500"
              }`}
            >
              {t.type === "success" ? "✓" : t.type === "error" ? "!" : "i"}
            </span>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
