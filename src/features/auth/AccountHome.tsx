"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Brand } from "../../components/Brand";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export function AccountHome({ email }: { email: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.replace("/conta");
    router.refresh();
  }

  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-header">
          <Brand />
          <button
            type="button"
            className="account-signout"
            onClick={() => void signOut()}
          >
            <LogOut size={17} /> Sair
          </button>
        </header>
        <section className="account-welcome">
          <span className="auth-overline">SUA JORNADA, NO SEU TEMPO</span>
          <h1 className="account-title">Boas-vindas de volta.</h1>
          <p className="account-copy">
            Sua conta Império Sofás está pronta para acompanhar seus próximos
            momentos.
          </p>
        </section>
        <section className="account-card">
          <div className="account-card-icon">
            <UserRound size={21} />
          </div>
          <div className="account-card-copy">
            <span className="account-card-label">CONTA DO CLIENTE</span>
            <h2>{email}</h2>
            <p>Cadastro pessoal · acesso confirmado por e-mail</p>
          </div>
        </section>
        <section className="account-card account-security-card">
          <div className="account-card-icon">
            <ShieldCheck size={21} />
          </div>
          <div className="account-card-copy">
            <span className="account-card-label">PROTEÇÃO DA CONTA</span>
            <h2>Verificação em duas etapas</h2>
            <p>
              Adicione um app autenticador para proteger seu acesso com TOTP.
            </p>
          </div>
          <Link className="account-card-link" href="/conta/seguranca">
            Gerenciar <ArrowRight size={17} />
          </Link>
        </section>
        <Link href="/loja/sofas" className="account-shop-link">
          Continuar explorando a coleção <ArrowRight size={17} />
        </Link>
        <p className="account-note">
          <KeyRound size={14} /> Seus dados de acesso são gerenciados com
          segurança pelo Supabase Auth.
        </p>
      </div>
    </main>
  );
}
