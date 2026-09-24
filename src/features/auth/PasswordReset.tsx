"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { Brand } from "../../components/Brand";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

export function PasswordReset() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    setError(null);
    if (password.length < 12) {
      setError("Use uma senha com pelo menos 12 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!supabase) {
      setError("A autenticação ainda não está conectada ao Supabase.");
      return;
    }
    submitLock.current = true;
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(
          "Não foi possível atualizar a senha. Solicite um novo link de recuperação.",
        );
        return;
      }
      setDone(true);
      window.setTimeout(() => {
        router.replace("/conta");
        router.refresh();
      }, 1800);
    } catch {
      setError(
        "Não foi possível atualizar a senha. Solicite um novo link de recuperação.",
      );
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-shell auth-reset-shell">
        <div className="auth-mobile-brand">
          <Brand />
          <Link href="/conta" className="auth-back-link">
            Voltar ao login
          </Link>
        </div>
        <section className="auth-reset-card">
          <span className="auth-success-icon">
            <KeyRound size={24} />
          </span>
          <span className="auth-overline">RECUPERAÇÃO DE ACESSO</span>
          <h1 className="auth-title">Escolha uma nova senha.</h1>
          <p className="auth-subtitle">
            Crie uma senha forte para proteger sua conta.
          </p>
          {done ? (
            <p className="security-message" role="status">
              Senha atualizada. Redirecionando para sua conta…
            </p>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="new-password">
                  Nova senha
                </label>
                <input
                  id="new-password"
                  className="auth-input"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="confirm-new-password">
                  Confirme a nova senha
                </label>
                <input
                  id="confirm-new-password"
                  className="auth-input"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="auth-alert" role="alert">
                  {error}
                </p>
              )}
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? "Atualizando…" : "Salvar nova senha"}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
