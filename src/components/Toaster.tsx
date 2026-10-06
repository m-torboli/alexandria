import clsx from "clsx";
import { CircleAlert } from "lucide-react";

import { useToasts } from "../store/toast";
import styles from "./Toaster.module.css";

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(styles.toast, toast.tone === "error" && styles.error)}
          onClick={() => dismiss(toast.id)}
        >
          {toast.tone === "error" && <CircleAlert size={15} />}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
