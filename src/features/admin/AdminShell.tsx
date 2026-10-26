import type { ReactNode } from "react";
import { AdminNav } from "./AdminNav";
import styles from "./admin-shell.module.css";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <AdminNav />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
