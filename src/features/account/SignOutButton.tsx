"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.replace("/conta");
    router.refresh();
  }
  return (
    <button type="button" className={className} onClick={() => void signOut()}>
      <LogOut size={16} /> Sair
    </button>
  );
}
