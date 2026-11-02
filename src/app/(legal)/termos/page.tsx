import type { Metadata } from "next";
import { terms } from "../../../features/legal/content";
import { LegalPage } from "../../../features/legal/LegalPage";

export const metadata: Metadata = { title: terms.title };

export default function Page() {
  return <LegalPage document={terms} />;
}
