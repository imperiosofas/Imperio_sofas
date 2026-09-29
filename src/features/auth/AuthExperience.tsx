"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, MailCheck, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { MfaSuccessSequence } from "./MfaSuccessSequence";
import { OtpCodeInput } from "./OtpCodeInput";
import {
  AuthAccountStage,
  type AccountMode,
  type AuthStep,
  type OAuthProvider,
} from "./AuthAccountStage";
import { AuthField } from "./AuthField";
import styles from "./auth-experience.module.css";

type View = AccountMode | "recover" | "mfa" | "sent";

function friendlyInitialError(value: string | null) {
  if (value === "confirmacao") {
    return "Este link não pôde ser confirmado. Peça um novo e tente novamente.";
  }
  if (value === "oauth") {
    return "Não foi possível continuar com este provedor. Tente novamente ou use seu e-mail.";
  }
  return value;
}

function getTitle(view: View) {
  switch (view) {
    case "login":
      return "Que bom ter você de volta.";
    case "register":
      return "Crie sua conta.";
    case "recover":
      return "Vamos recuperar seu acesso.";
    case "mfa":
      return "Confirme que é você.";
    case "sent":
      return "Confira sua caixa de entrada.";
  }
}

function getSubtitle(view: View) {
  switch (view) {
    case "login":
      return "Entre para acompanhar suas escolhas e continuar de onde parou.";
    case "register":
      return "Guarde suas escolhas e tenha uma experiência completa com a Império Sofás.";
    case "recover":
      return "Informe seu e-mail para receber as instruções, se houver uma conta vinculada.";
    case "mfa":
      return "Digite o código atual do app autenticador vinculado à sua conta.";
    case "sent":
      return "Enviamos uma mensagem segura para o endereço informado, quando aplicável.";
  }
}

function friendlyAuthFailure(
  value: unknown,
  fallback: string,
  options: { weakPassword?: boolean } = {},
) {
  if (!value || typeof value !== "object") return fallback;
  const error = value as { status?: unknown; code?: unknown; name?: unknown };

  if (error.status === 429) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  if (options.weakPassword && error.code === "weak_password") {
    return "Essa senha não atende aos requisitos de segurança da conta. Escolha outra e tente novamente.";
  }
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return "Não foi possível conectar agora. Confira sua conexão e tente novamente.";
  }
  return fallback;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AuthExperience({
  isConfigured,
  nextPath,
  initialError,
  initialMfaRequired = false,
}: {
  isConfigured: boolean;
  nextPath: string;
  initialError: string | null;
  initialMfaRequired?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const reducedMotion = Boolean(useReducedMotion());
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const submitLockRef = useRef(false);
  const successRedirectRef = useRef(false);
  const [view, setView] = useState<View>(initialMfaRequired ? "mfa" : "login");
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(() =>
    friendlyInitialError(initialError),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [mfaVerified, setMfaVerified] = useState(false);

  const googleEnabled =
    isConfigured && process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";
  const appleEnabled =
    isConfigured && process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED === "true";

  useEffect(() => {
    if (view !== "mfa" || mfaVerified) return;
    const focusDelay = initialMfaRequired ? 0 : reducedMotion ? 120 : 230;
    const timeout = window.setTimeout(
      () => codeInputRef.current?.focus({ preventScroll: true }),
      focusDelay,
    );
    return () => window.clearTimeout(timeout);
  }, [initialMfaRequired, mfaVerified, reducedMotion, view]);

  useEffect(() => {
    const authClient = supabase;
    if (!initialMfaRequired || !authClient) return;
    let active = true;

    async function startPendingMfaChallenge(
      client: NonNullable<typeof supabase>,
    ) {
      setBusy(true);
      setError(null);
      try {
        const [assuranceResult, factorsResult] = await Promise.all([
          client.auth.mfa.getAuthenticatorAssuranceLevel(),
          client.auth.mfa.listFactors(),
        ]);
        if (
          assuranceResult.error ||
          factorsResult.error ||
          !assuranceResult.data ||
          !factorsResult.data
        ) {
          throw new Error(
            "Não foi possível iniciar a verificação em duas etapas. Tente novamente.",
          );
        }

        if (assuranceResult.data.currentLevel === "aal2") {
          router.replace(nextPath);
          router.refresh();
          return;
        }

        const verifiedTotp = factorsResult.data.totp.find(
          (factor) => factor.status === "verified",
        );
        if (!verifiedTotp) {
          throw new Error(
            "Esta sessão exige uma verificação adicional não disponível nesta tela. Saia e entre novamente ou fale com o atendimento.",
          );
        }

        const { data: challenge, error: challengeError } =
          await client.auth.mfa.challenge({ factorId: verifiedTotp.id });
        if (challengeError || !challenge) {
          throw new Error(
            "Não foi possível iniciar a verificação em duas etapas. Tente novamente.",
          );
        }
        if (!active) return;
        setFactorId(verifiedTotp.id);
        setChallengeId(challenge.id);
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível iniciar a verificação em duas etapas. Tente novamente.",
          );
        }
      } finally {
        if (active) setBusy(false);
      }
    }

    void startPendingMfaChallenge(authClient);
    return () => {
      active = false;
    };
  }, [initialMfaRequired, nextPath, router, supabase]);

  function changeView(next: View) {
    if (submitLockRef.current || busy) return;
    setError(null);
    setNotice(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    if (next === "login" || next === "register" || next === "recover") {
      setStep("email");
    }
    setView(next);
    if (next === "recover") {
      window.setTimeout(
        () => emailInputRef.current?.focus({ preventScroll: true }),
        reducedMotion ? 120 : 230,
      );
    }
  }

  function continueWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy ||
      submitLockRef.current ||
      !(view === "login" || view === "register")
    )
      return;
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError("Digite um endereço de e-mail válido.");
      return;
    }
    setEmail(normalizedEmail);
    setStep("password");
  }

  function returnToEmail() {
    if (busy) return;
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setStep("email");
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
    submittedView: View = view,
  ) {
    event.preventDefault();
    if (submitLockRef.current || busy) return;
    setError(null);
    setNotice(null);
    if (!isConfigured || !supabase) {
      setError("Não foi possível acessar sua conta agora. Tente novamente.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (
      (submittedView === "login" ||
        submittedView === "register" ||
        submittedView === "recover") &&
      !isValidEmail(normalizedEmail)
    ) {
      setError("Digite um endereço de e-mail válido.");
      return;
    }
    if (
      submittedView === "login" ||
      submittedView === "register" ||
      submittedView === "recover"
    ) {
      setEmail(normalizedEmail);
    }
    if (submittedView === "register" && password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    submitLockRef.current = true;
    setBusy(true);
    try {
      if (submittedView === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) {
          setError(
            friendlyAuthFailure(
              signInError,
              "Não foi possível entrar com esses dados. Confira e tente novamente.",
            ),
          );
          return;
        }

        const [assuranceResult, factorsResult] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ]);
        if (
          assuranceResult.error ||
          factorsResult.error ||
          !assuranceResult.data ||
          !factorsResult.data
        ) {
          await supabase.auth.signOut();
          throw new Error(
            "Não foi possível confirmar a segurança da conta. Tente entrar novamente.",
          );
        }

        const assurance = assuranceResult.data;
        const verifiedTotp = factorsResult.data.totp.find(
          (factor) => factor.status === "verified",
        );
        if (
          assurance.nextLevel === "aal2" &&
          assurance.currentLevel !== "aal2"
        ) {
          if (!verifiedTotp) {
            await supabase.auth.signOut();
            throw new Error(
              "Esta conta exige um método de verificação ainda não compatível com este acesso. Fale com o atendimento.",
            );
          }
          const { data: challenge, error: challengeError } =
            await supabase.auth.mfa.challenge({ factorId: verifiedTotp.id });
          if (challengeError || !challenge) {
            throw new Error(
              "Não foi possível iniciar a verificação em duas etapas. Tente entrar novamente.",
            );
          }
          setFactorId(verifiedTotp.id);
          setChallengeId(challenge.id);
          setPassword("");
          setView("mfa");
          return;
        }
        router.replace(nextPath);
        router.refresh();
        return;
      }

      if (submittedView === "register") {
        const confirmationUrl = new URL(
          "/auth/confirm",
          window.location.origin,
        );
        confirmationUrl.searchParams.set("next", nextPath);
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: { emailRedirectTo: confirmationUrl.toString() },
          });
        if (signUpError) {
          setError(
            friendlyAuthFailure(
              signUpError,
              "Não foi possível iniciar o cadastro. Confira os dados e tente novamente.",
              { weakPassword: true },
            ),
          );
          return;
        }
        if (signUpData.session) {
          router.replace(nextPath);
          router.refresh();
          return;
        }
        setNotice(
          "Se o cadastro puder ser concluído, enviaremos um link de confirmação para este e-mail.",
        );
        setView("sent");
        return;
      }

      if (submittedView === "recover") {
        const recoveryUrl = new URL("/auth/confirm", window.location.origin);
        recoveryUrl.searchParams.set("next", "/conta/redefinir-senha");
        const { error: recoveryError } =
          await supabase.auth.resetPasswordForEmail(normalizedEmail, {
            redirectTo: recoveryUrl.toString(),
          });
        if (recoveryError) {
          setError(
            friendlyAuthFailure(
              recoveryError,
              "Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.",
            ),
          );
          return;
        }
        setNotice(
          "Se houver uma conta para este e-mail, enviaremos instruções de recuperação.",
        );
        setView("sent");
      }
    } catch (caught) {
      setError(
        friendlyAuthFailure(caught, "Ocorreu um erro. Tente novamente."),
      );
    } finally {
      submitLockRef.current = false;
      setBusy(false);
    }
  }

  async function startOAuth(provider: OAuthProvider) {
    const enabled = provider === "google" ? googleEnabled : appleEnabled;
    if (!enabled || busy || submitLockRef.current) return;
    setError(null);
    if (!isConfigured || !supabase) {
      setError(
        provider === "google"
          ? "Não foi possível continuar com o Google agora. Tente novamente ou use seu e-mail."
          : "Não foi possível continuar com a Apple agora. Tente novamente ou use seu e-mail.",
      );
      return;
    }

    submitLockRef.current = true;
    setBusy(true);
    setBusyProvider(provider);
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", nextPath);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl.toString() },
      });
      if (oauthError) {
        setError(
          friendlyAuthFailure(
            oauthError,
            provider === "google"
              ? "Não foi possível continuar com o Google. Tente novamente ou use seu e-mail."
              : "Não foi possível continuar com a Apple. Tente novamente ou use seu e-mail.",
          ),
        );
        return;
      }
    } catch (caught) {
      setError(
        friendlyAuthFailure(
          caught,
          "Não foi possível concluir o acesso. Tente novamente.",
        ),
      );
    } finally {
      submitLockRef.current = false;
      setBusy(false);
      setBusyProvider(null);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current || busy) return;
    setError(null);
    if (!supabase || code.length !== 6) {
      setError("Digite os seis números do app autenticador.");
      return;
    }
    submitLockRef.current = true;
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });
      if (verifyError) {
        setError(
          (verifyError.status ?? 0) >= 500
            ? "Não foi possível verificar agora. Confira sua conexão e tente de novo."
            : "Código inválido ou expirado. Confira o app autenticador e tente de novo.",
        );
        return;
      }
      setMfaVerified(true);
    } catch {
      setError(
        "Não foi possível verificar agora. Confira sua conexão e tente de novo.",
      );
    } finally {
      submitLockRef.current = false;
      setBusy(false);
    }
  }

  function finishMfaSuccess() {
    if (successRedirectRef.current) return;
    successRedirectRef.current = true;
    router.replace(nextPath);
    router.refresh();
  }

  const isAccountMode = view === "login" || view === "register";
  const accountMode: AccountMode = view === "register" ? "register" : "login";

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

        <div
          className={styles.authFrame}
          data-auth-shell
          data-auth-view={view}
          data-auth-mode={accountMode}
          data-auth-step={step}
          aria-busy={busy || undefined}
        >
          {isAccountMode && (
            <div
              className={styles.modeSwitch}
              role="group"
              aria-label="Escolha entre entrar ou criar uma conta"
            >
              {(["login", "register"] as const).map((item) => {
                const selected = item === accountMode;
                const label = item === "login" ? "Entrar" : "Criar conta";
                return (
                  <button
                    key={item}
                    id={`auth-tab-${item}`}
                    className={styles.modeTab}
                    type="button"
                    aria-pressed={selected}
                    disabled={busy}
                    onClick={() => changeView(item)}
                  >
                    {label}
                    {selected && (
                      <motion.span
                        className={styles.modeIndicator}
                        layoutId="auth-mode-indicator"
                        transition={{
                          duration: reducedMotion ? 0 : 0.27,
                          ease: [0.22, 0.72, 0.22, 1],
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <motion.section
            className={styles.surface}
            aria-labelledby="auth-title"
            aria-busy={busy || undefined}
            layout={reducedMotion ? false : "size"}
            transition={{
              layout: {
                duration: reducedMotion ? 0 : 0.22,
                ease: [0.22, 0.72, 0.22, 1],
              },
            }}
          >
            <div className={styles.surfaceInner}>
              <header className={styles.cardHeading}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={view}
                    initial={
                      reducedMotion ? { opacity: 0 } : { opacity: 0, y: 7 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }
                    }
                    transition={{ duration: reducedMotion ? 0.1 : 0.2 }}
                  >
                    <h1 id="auth-title" className={styles.title}>
                      {getTitle(view)}
                    </h1>
                    <p className={styles.subtitle}>{getSubtitle(view)}</p>
                  </motion.div>
                </AnimatePresence>
              </header>

              <section
                className={styles.content}
                aria-label="Acesso à conta Império Sofás"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isAccountMode ? (
                    <motion.div
                      key="account"
                      initial={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: -3 }
                      }
                      transition={{ duration: reducedMotion ? 0.1 : 0.17 }}
                    >
                      <AuthAccountStage
                        mode={accountMode}
                        step={step}
                        email={email}
                        password={password}
                        confirmPassword={confirmPassword}
                        showPassword={showPassword}
                        busy={busy}
                        busyProvider={busyProvider}
                        error={error}
                        googleEnabled={googleEnabled}
                        appleEnabled={appleEnabled}
                        emailInputRef={emailInputRef}
                        passwordInputRef={passwordInputRef}
                        onModeChange={changeView}
                        onStepChange={returnToEmail}
                        onEmailChange={setEmail}
                        onPasswordChange={setPassword}
                        onConfirmPasswordChange={setConfirmPassword}
                        onShowPasswordChange={() =>
                          setShowPassword((visible) => !visible)
                        }
                        onContinueWithEmail={continueWithEmail}
                        onSubmit={(event) => submit(event, view)}
                        onRecover={() => changeView("recover")}
                        onOAuth={startOAuth}
                      />
                    </motion.div>
                  ) : view === "recover" ? (
                    <motion.div
                      key="recover"
                      className={styles.statePanel}
                      initial={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: -3 }
                      }
                      transition={{ duration: reducedMotion ? 0.1 : 0.18 }}
                    >
                      <form
                        className={styles.stateForm}
                        noValidate
                        onSubmit={(event) => submit(event, "recover")}
                      >
                        <AuthField
                          id="auth-recovery-email"
                          name="email"
                          label="Seu e-mail"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          enterKeyHint="go"
                          value={email}
                          onChange={setEmail}
                          inputRef={emailInputRef}
                          leadingIcon={
                            <MailCheck size={19} aria-hidden="true" />
                          }
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
                          <span>
                            {busy ? "Enviando…" : "Enviar instruções"}
                          </span>
                          {busy ? (
                            <span
                              className={styles.buttonSpinner}
                              aria-hidden="true"
                            />
                          ) : (
                            <ArrowRight size={19} aria-hidden="true" />
                          )}
                        </button>
                        <button
                          className={styles.textButton}
                          type="button"
                          disabled={busy}
                          onClick={() => changeView("login")}
                        >
                          <ArrowLeft size={16} aria-hidden="true" /> Voltar para
                          entrar
                        </button>
                      </form>
                    </motion.div>
                  ) : view === "sent" ? (
                    <motion.div
                      key="sent"
                      className={styles.statePanel}
                      role="status"
                      aria-live="polite"
                      initial={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: -3 }
                      }
                      transition={{ duration: reducedMotion ? 0.1 : 0.18 }}
                    >
                      <span className={styles.stateIcon} aria-hidden="true">
                        <MailCheck size={24} strokeWidth={1.7} />
                      </span>
                      <p className={styles.stateMessage}>{notice}</p>
                      <button
                        className={styles.secondaryButton}
                        type="button"
                        onClick={() => changeView("login")}
                      >
                        <ArrowLeft size={16} aria-hidden="true" /> Voltar para
                        entrar
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="mfa"
                      className={styles.statePanel}
                      initial={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: -3 }
                      }
                      transition={{ duration: reducedMotion ? 0.1 : 0.18 }}
                    >
                      {mfaVerified ? (
                        <MfaSuccessSequence
                          code={code}
                          onComplete={finishMfaSuccess}
                        />
                      ) : (
                        <form
                          className={styles.stateForm}
                          onSubmit={verifyCode}
                        >
                          <span className={styles.stateIcon} aria-hidden="true">
                            <ShieldCheck size={24} strokeWidth={1.7} />
                          </span>
                          <div className={styles.field}>
                            <label className={styles.label} htmlFor="auth-code">
                              Código do app autenticador
                            </label>
                            <OtpCodeInput
                              id="auth-code"
                              inputRef={codeInputRef}
                              value={code}
                              onChange={setCode}
                              invalid={Boolean(error)}
                              disabled={busy}
                              describedBy={
                                error ? "auth-mfa-error" : "auth-code-help"
                              }
                            />
                            <p id="auth-code-help" className={styles.mfaHelper}>
                              {busy
                                ? "Confirmando seu código…"
                                : "Digite ou cole os seis dígitos do app autenticador. Não é um código por SMS."}
                            </p>
                          </div>
                          {error && (
                            <p
                              id="auth-mfa-error"
                              className={styles.errorMessage}
                              role="alert"
                              aria-live="assertive"
                            >
                              {error}
                            </p>
                          )}
                          <button
                            className={styles.primaryButton}
                            type="submit"
                            disabled={busy || code.length !== 6}
                          >
                            <span>
                              {busy ? "Verificando…" : "Verificar e continuar"}
                            </span>
                            {busy ? (
                              <span
                                className={styles.buttonSpinner}
                                aria-hidden="true"
                              />
                            ) : (
                              <ArrowRight size={19} aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            className={styles.textButton}
                            disabled={busy}
                            onClick={() => {
                              void supabase?.auth.signOut();
                              changeView("login");
                            }}
                          >
                            <ArrowLeft size={16} aria-hidden="true" /> Voltar ao
                            login
                          </button>
                        </form>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}
