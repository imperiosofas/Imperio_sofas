import type { ReactNode } from "react";
import { StoreFooter } from "../../features/legal/StoreFooter";

// Seller identification (Decreto 7.962/2013, art. 2) on every store page.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <StoreFooter />
    </>
  );
}
