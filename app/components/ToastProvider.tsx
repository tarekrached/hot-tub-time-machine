import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import styles from "~/styles/toast.module.css";

interface Toast {
  id: number;
  message: string;
  type: "error" | "success" | "info";
  onRetry?: () => void;
}

interface ToastContextValue {
  showToast: (
    message: string,
    type?: Toast["type"],
    onRetry?: () => void
  ) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: Toast["type"] = "error", onRetry?: () => void) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, type, onRetry }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={styles.container}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${styles[toast.type]}`}
          >
            <span className={styles.message}>{toast.message}</span>
            <div className={styles.actions}>
              {toast.onRetry && (
                <button
                  className={styles.retryBtn}
                  onClick={() => {
                    toast.onRetry?.();
                    dismiss(toast.id);
                  }}
                >
                  Retry
                </button>
              )}
              <button
                className={styles.dismissBtn}
                onClick={() => dismiss(toast.id)}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
