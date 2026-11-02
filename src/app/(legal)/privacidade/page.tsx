import type { Metadata } from "next";
import { privacy } from "../../../features/legal/content";
import { LegalPage } from "../../../features/legal/LegalPage";

export const metadata: Metadata = { title: privacy.title };

export default function Page() {
  return <LegalPage document={privacy} />;
}
