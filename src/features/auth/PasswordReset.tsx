"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { AuthField } from "./AuthField";
import styles from "./auth-experience.module.css";

export function PasswordReset() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const reducedMotion = Boolean(useReducedMotion());
  const submitLock = useRef(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || busy) return;
    setError(null);

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!supabase) {
      setError(
        "Não foi possível atualizar a senha agora. Solicite um novo link de recuperação.",
      );
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
          updateError.code === "weak_password"
            ? "Essa senha não atende aos requisitos de segurança da conta. Escolha outra e tente novamente."
            : "Não foi possível atualizar a senha. Solicite um novo link de recuperação.",
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
    <main className={styles.page}>
      <div className={styles.orbit} aria-hidden="true" />
      <div className={styles.shell}>
        <Link
          href="/"
          className={styles.brand}
          aria-label="Império Sofás — início"
        >
          <Image
            src="/imperio-sofas-logo-128.webp"
            alt=""
            width={48}
            height={48}
            className={styles.brandMark}
            priority
          />
          <span className={styles.brandCopy}>
            <span className={styles.brandName}>Império Sofás</span>
            <span className={styles.brandLocation}>Vale do Paraíba</span>
          </span>
        </Link>

        <section className={`${styles.surface} ${styles.standaloneSurface}`}>
          <div className={styles.surfaceInner}>
            <header className={styles.cardHeading}>
              <motion.div
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0.1 : 0.2 }}
              >
                <span className={styles.stateIcon} aria-hidden="true">
                  <KeyRound size={22} strokeWidth={1.7} />
                </span>
                <h1 className={styles.title}>Escolha uma nova senha.</h1>
                <p className={styles.subtitle}>
                  Crie uma senha para voltar à sua conta com segurança.
                </p>
              </motion.div>
            </header>

            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.div
                  key="success"
                  className={styles.statePanel}
                  role="status"
                  aria-live="polite"
                  initial={
                    reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0.1 : 0.18 }}
                >
                  <p className={styles.stateMessage}>
                    Senha atualizada. Redirecionando para sua conta…
                  </p>
                  <Link className={styles.secondaryButton} href="/conta">
                    Ir para minha conta{" "}
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </motion.div>
              ) : (
                <motion.form
                  key="password-form"
                  className={styles.stateForm}
                  onSubmit={submit}
                  initial={
                    reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0.1 : 0.18 }}
                >
                  <AuthField
                    id="new-password"
                    name="new-password"
                    label="Nova senha"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    enterKeyHint="next"
                    value={password}
                    onChange={setPassword}
                    required
                    trailingAction={
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        aria-label={
                          showPassword ? "Ocultar senha" : "Mostrar senha"
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((visible) => !visible)}
                        disabled={busy}
                      >
                        {showPassword ? (
                          <EyeOff size={19} aria-hidden="true" />
                        ) : (
                          <Eye size={19} aria-hidden="true" />
                        )}
                      </button>
                    }
                  />
                  <AuthField
                    id="confirm-new-password"
                    name="confirm-new-password"
                    label="Confirme a nova senha"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    enterKeyHint="go"
                    value={confirm}
                    onChange={setConfirm}
                    required
                  />
                  {error && (
                    <p className={styles.errorMessage} role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    className={styles.primaryButton}
                    type="submit"
                    disabled={busy}
                  >
                    <span>{busy ? "Atualizando…" : "Salvar nova senha"}</span>
                    {busy ? (
                      <span
                        className={styles.buttonSpinner}
                        aria-hidden="true"
                      />
                    ) : (
                      <ArrowRight size={19} aria-hidden="true" />
                    )}
                  </button>
                  <Link className={styles.textButton} href="/conta">
                    Voltar ao login
                  </Link>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </main>
  );
}
