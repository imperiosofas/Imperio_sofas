import type { Metadata } from "next";
import { returns } from "../../../features/legal/content";
import { LegalPage } from "../../../features/legal/LegalPage";

export const metadata: Metadata = { title: returns.title };

export default function Page() {
  return <LegalPage document={returns} />;
}
