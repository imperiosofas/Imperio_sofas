"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import sofa from "../../assets/products/berlim-enhanced-800.webp";
import signupSofa from "../../assets/products/maximo-enhanced-800.webp";
import { Brand } from "../../components/Brand";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { MfaSuccessSequence } from "./MfaSuccessSequence";
import { OtpCodeInput } from "./OtpCodeInput";

type View = "login" | "register" | "recover" | "mfa" | "sent";

const formVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 12 : -12,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.24,
      ease: [0.22, 0.72, 0.22, 1],
      staggerChildren: 0.035,
      delayChildren: 0.025,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -7 : 7,
    transition: { duration: 0.12, ease: "easeIn" },
  }),
};

const mobileFormVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 8 : -8,
    y: direction > 0 ? 18 : -18,
  }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.22, 0.72, 0.22, 1],
      staggerChildren: 0.035,
      delayChildren: 0.025,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -6 : 6,
    y: direction > 0 ? -12 : 12,
    transition: { duration: 0.16, ease: "easeIn" },
  }),
};

const fieldVariants: Variants = {
  enter: { opacity: 0, y: 5 },
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: { opacity: 0, y: -2, transition: { duration: 0.08 } },
};

export function AuthExperience({
  isConfigured,
  nextPath,
  initialError,
}: {
  isConfigured: boolean;
  nextPath: string;
  initialError: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const reduceMotion = useReducedMotion();
  const formPanelRef = useRef<HTMLElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const sentStatusRef = useRef<HTMLDivElement>(null);
  const pendingViewRef = useRef<View | null>(null);
  const focusAfterTransitionRef = useRef(false);
  const submitLockRef = useRef(false);
  const successRedirectRef = useRef(false);
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<
    "idle" | "cover" | "reveal"
  >("idle");
  const [transitionDirection, setTransitionDirection] = useState<
    "forward" | "backward"
  >("forward");
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isAccountSwap, setIsAccountSwap] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const isLogin = view === "login";
  const isRegister = view === "register";
  const isRecover = view === "recover";
  const isMfa = view === "mfa";

  useEffect(() => {
    const media = window.matchMedia("(max-width: 899px)");
    const syncViewport = () => setIsCompactViewport(media.matches);
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  useLayoutEffect(() => {
    if (transitionPhase !== "idle") return;
    if (focusAfterTransitionRef.current) {
      focusAfterTransitionRef.current = false;
      if (isCompactViewport && (view === "login" || view === "register")) {
        formPanelRef.current
          ?.querySelector<HTMLElement>(".auth-title")
          ?.focus({ preventScroll: true });
        return;
      }
      if (view === "mfa") codeInputRef.current?.focus({ preventScroll: true });
      else if (view === "sent")
        sentStatusRef.current?.focus({ preventScroll: true });
      else firstFieldRef.current?.focus({ preventScroll: true });
      const heading =
        formPanelRef.current?.querySelector<HTMLElement>(".auth-form-head");
      const headingTop = heading?.getBoundingClientRect().top;
      if (
        window.matchMedia("(max-width: 899px)").matches &&
        headingTop !== undefined &&
        (headingTop < 0 || headingTop > 160)
      ) {
        formPanelRef.current?.scrollIntoView({
          block: "start",
          behavior: reduceMotion ? "auto" : "smooth",
        });
      }
      return;
    }
    if (view === "mfa" && !mfaVerified)
      codeInputRef.current?.focus({ preventScroll: true });
  }, [isCompactViewport, mfaVerified, reduceMotion, transitionPhase, view]);

  function transitionTo(next: View, focusAfter = true) {
    if (next === view) return;
    setError(null);
    setNotice(null);
    setTransitionDirection(
      view === "register" || view === "mfa" || view === "sent"
        ? "backward"
        : "forward",
    );
    setIsAccountSwap(
      (view === "login" || view === "register") &&
        (next === "login" || next === "register"),
    );
    pendingViewRef.current = next;
    focusAfterTransitionRef.current = focusAfter;
    if (reduceMotion) {
      pendingViewRef.current = null;
      setView(next);
      setTransitionPhase("idle");
      setIsAccountSwap(false);
    } else {
      setTransitionPhase("cover");
    }
  }

  function changeView(next: View) {
    if (submitLockRef.current || transitionPhase !== "idle") return;
    transitionTo(next);
  }

  function handleShutterAnimationComplete() {
    if (transitionPhase === "cover") {
      const nextView = pendingViewRef.current;
      if (!nextView) return;
      pendingViewRef.current = null;
      setView(nextView);
      setTransitionPhase("reveal");
      return;
    }
    if (transitionPhase === "reveal") {
      setTransitionPhase("idle");
      setIsAccountSwap(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current || transitionPhase !== "idle") return;
    setError(null);
    setNotice(null);
    if (!isConfigured || !supabase) {
      setError("Não foi possível acessar sua conta agora. Tente novamente.");
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    submitLockRef.current = true;
    setBusy(true);
    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError)
          throw new Error(
            "Não foi possível entrar. Confira seus dados e tente novamente.",
          );
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
            "Não foi possível confirmar o estado de segurança da conta. Tente entrar novamente.",
          );
        }
        const { data: assurance } = assuranceResult;
        const { data: factors } = factorsResult;
        const verifiedTotp = factors?.totp.find(
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
          if (challengeError || !challenge)
            throw new Error(
              "Não foi possível iniciar a verificação em duas etapas. Tente entrar novamente.",
            );
          setFactorId(verifiedTotp.id);
          setChallengeId(challenge.id);
          setPassword("");
          transitionTo("mfa");
          return;
        }
        router.replace(nextPath);
        router.refresh();
        return;
      }

      if (isRegister) {
        if (password.length < 12)
          throw new Error("Use uma senha com pelo menos 12 caracteres.");
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=%2Fconta`,
          },
        });
        if (signUpError)
          throw new Error(
            "Não foi possível iniciar o cadastro. Confira os dados e tente novamente.",
          );
        transitionTo("sent");
        setNotice(
          "Se o cadastro puder ser concluído, enviaremos um link de confirmação para este e-mail.",
        );
        return;
      }

      if (isRecover) {
        const { error: recoveryError } =
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/confirm?next=%2Fconta%2Fredefinir-senha`,
          });
        if (recoveryError)
          throw new Error(
            "Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.",
          );
        transitionTo("sent");
        setNotice(
          "Se houver uma conta para este e-mail, enviaremos instruções de recuperação.",
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Ocorreu um erro. Tente novamente.",
      );
    } finally {
      submitLockRef.current = false;
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current || transitionPhase !== "idle") return;
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

  const title = isLogin
    ? "Que bom ter você de volta."
    : isRegister
      ? "Sua casa começa por aqui."
      : isRecover
        ? "Vamos recuperar seu acesso."
        : isMfa
          ? "Confirme que é você."
          : "Confira sua caixa de entrada.";
  const intro = isMfa
    ? "Digite o código atual do app autenticador vinculado à sua conta."
    : isRegister
      ? "Acompanhe suas escolhas e tenha seus dados à mão, com cuidado e segurança."
      : isRecover
        ? "Informe o e-mail usado no cadastro. Enviaremos os próximos passos, se houver uma conta vinculada."
        : isLogin
          ? "Entre para acompanhar sua jornada com a Império Sofás."
          : "Enviamos um link seguro para o endereço informado, quando aplicável.";

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb--one" aria-hidden="true" />
      <div className="auth-orb auth-orb--two" aria-hidden="true" />
      <div className="auth-shell">
        <div className="auth-mobile-brand">
          <Brand />
          <Link href="/loja/sofas" className="auth-back-link">
            <ArrowLeft size={15} /> Loja
          </Link>
        </div>
        <motion.div
          aria-busy={busy || transitionPhase !== "idle"}
          inert={transitionPhase !== "idle"}
          className={`auth-card${isRegister ? " auth-card--register" : ""}${isMfa ? " auth-card--mfa" : ""}`}
        >
          <motion.section
            layout={!isCompactViewport || !isAccountSwap}
            ref={formPanelRef}
            data-auth-view={view}
            className={`auth-form-panel${
              isRegister ? " auth-form-panel--register" : ""
            }`}
          >
            <div className="auth-form-head">
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
                  transition={{
                    duration: reduceMotion ? 0.12 : 0.2,
                    ease: "easeOut",
                  }}
                >
                  {!isLogin && !isRegister && (
                    <p className="auth-overline">
                      {isMfa
                        ? "SEGURANÇA EM DUAS ETAPAS"
                        : isRecover
                          ? "ACESSO À CONTA"
                          : "QUASE LÁ"}
                    </p>
                  )}
                  <h1 className="auth-title" tabIndex={-1}>
                    {title}
                  </h1>
                  <p className="auth-subtitle">{intro}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            {initialError === "confirmacao" && (
              <p className="auth-alert" role="alert">
                Não foi possível confirmar este link. Peça um novo e tente
                novamente.
              </p>
            )}
            <div className="auth-state-stage">
              <AnimatePresence
                mode={isCompactViewport && isAccountSwap ? "sync" : "wait"}
                initial={false}
                custom={transitionDirection === "forward" ? 1 : -1}
              >
                {view === "sent" ? (
                  <motion.div
                    key="sent"
                    className="auth-sent"
                    ref={sentStatusRef}
                    tabIndex={-1}
                    role="group"
                    variants={formVariants}
                    custom={transitionDirection === "forward" ? 1 : -1}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    <span className="auth-success-icon">
                      <ShieldCheck size={26} />
                    </span>
                    <p role="status">{notice}</p>
                    <button
                      type="button"
                      onClick={() => changeView("login")}
                      className="auth-secondary"
                    >
                      Voltar para entrar <ArrowRight size={16} />
                    </button>
                  </motion.div>
                ) : isMfa ? (
                  <motion.form
                    key="mfa"
                    className="auth-form"
                    onSubmit={verifyCode}
                    variants={formVariants}
                    custom={transitionDirection === "forward" ? 1 : -1}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    {mfaVerified ? (
                      <MfaSuccessSequence
                        code={code}
                        onComplete={finishMfaSuccess}
                      />
                    ) : (
                      <>
                        <motion.div
                          className="auth-field"
                          variants={fieldVariants}
                        >
                          <label className="auth-label" htmlFor="auth-code">
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
                              error ? "auth-error" : "auth-code-help"
                            }
                          />
                          <p
                            id="auth-code-help"
                            className={
                              busy
                                ? "auth-helper auth-live-status"
                                : "auth-helper"
                            }
                            role={busy ? "status" : undefined}
                            aria-live={busy ? "polite" : undefined}
                          >
                            {busy
                              ? "Confirmando seu código…"
                              : "Digite ou cole os seis dígitos do app autenticador. Não é um código por SMS."}
                          </p>
                        </motion.div>
                        {error && (
                          <motion.p
                            className="auth-alert"
                            id="auth-error"
                            role="alert"
                            aria-live="assertive"
                            variants={fieldVariants}
                          >
                            {error}
                          </motion.p>
                        )}
                        <motion.button
                          className="auth-submit"
                          type="submit"
                          disabled={busy || code.length !== 6}
                          variants={fieldVariants}
                        >
                          {busy ? "Verificando…" : "Verificar e continuar"}
                          <ArrowRight size={17} />
                        </motion.button>
                        <motion.button
                          type="button"
                          className="auth-text-button"
                          disabled={busy}
                          variants={fieldVariants}
                          onClick={() => {
                            void supabase?.auth.signOut();
                            changeView("login");
                          }}
                        >
                          Voltar ao login
                        </motion.button>
                      </>
                    )}
                  </motion.form>
                ) : (
                  <motion.form
                    key={view}
                    className={`auth-form${
                      isRegister ? " auth-form--register" : ""
                    }`}
                    onSubmit={submit}
                    variants={
                      isCompactViewport && isAccountSwap
                        ? mobileFormVariants
                        : formVariants
                    }
                    custom={transitionDirection === "forward" ? 1 : -1}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    {isRegister && (
                      <motion.div
                        className="auth-field"
                        variants={fieldVariants}
                      >
                        <label className="auth-label" htmlFor="auth-name">
                          Como podemos chamar você?
                        </label>
                        <input
                          id="auth-name"
                          ref={firstFieldRef}
                          className="auth-input"
                          type="text"
                          autoComplete="name"
                          enterKeyHint="next"
                          maxLength={100}
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          required
                        />
                      </motion.div>
                    )}
                    <motion.div className="auth-field" variants={fieldVariants}>
                      <label className="auth-label" htmlFor="auth-email">
                        E-mail
                      </label>
                      <input
                        id="auth-email"
                        ref={isRegister ? undefined : firstFieldRef}
                        className="auth-input"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        enterKeyHint="next"
                        spellCheck={false}
                        value={email}
                        aria-describedby={error ? "auth-form-error" : undefined}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </motion.div>
                    {!isRecover && (
                      <motion.div
                        className="auth-field"
                        variants={fieldVariants}
                      >
                        <div className="auth-label-row">
                          <label className="auth-label" htmlFor="auth-password">
                            Senha
                          </label>
                          {isLogin && (
                            <button
                              type="button"
                              className="auth-inline-link"
                              onClick={() => changeView("recover")}
                            >
                              Esqueceu?
                            </button>
                          )}
                        </div>
                        <div className="auth-password-wrap">
                          <input
                            id="auth-password"
                            className="auth-input"
                            type={showPassword ? "text" : "password"}
                            autoComplete={
                              isRegister ? "new-password" : "current-password"
                            }
                            enterKeyHint={isRegister ? "next" : "go"}
                            minLength={isRegister ? 12 : undefined}
                            value={password}
                            aria-describedby={
                              error ? "auth-form-error" : undefined
                            }
                            onChange={(event) =>
                              setPassword(event.target.value)
                            }
                            required
                          />
                          <button
                            type="button"
                            className="auth-show-password"
                            aria-label={
                              showPassword ? "Ocultar senha" : "Mostrar senha"
                            }
                            onClick={() =>
                              setShowPassword((visible) => !visible)
                            }
                          >
                            {showPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}
                    {isRegister && (
                      <motion.div
                        className="auth-field"
                        variants={fieldVariants}
                      >
                        <label
                          className="auth-label"
                          htmlFor="auth-confirm-password"
                        >
                          Confirme sua senha
                        </label>
                        <input
                          id="auth-confirm-password"
                          className="auth-input"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          enterKeyHint="go"
                          minLength={12}
                          value={confirmPassword}
                          aria-describedby={
                            error ? "auth-form-error" : undefined
                          }
                          onChange={(event) =>
                            setConfirmPassword(event.target.value)
                          }
                          required
                        />
                        <p className="auth-helper">
                          Use pelo menos 12 caracteres.
                        </p>
                      </motion.div>
                    )}
                    {error && (
                      <motion.p
                        className="auth-alert"
                        id="auth-form-error"
                        role="alert"
                        aria-live="assertive"
                        variants={fieldVariants}
                      >
                        {error}
                      </motion.p>
                    )}
                    <motion.button
                      className="auth-submit"
                      type="submit"
                      disabled={busy || transitionPhase !== "idle"}
                      variants={fieldVariants}
                    >
                      {busy
                        ? "Aguarde…"
                        : isRegister
                          ? "Criar minha conta"
                          : isRecover
                            ? "Enviar instruções"
                            : "Entrar na minha conta"}
                      {!busy && <ArrowRight size={17} />}
                    </motion.button>
                    <div className="auth-switch">
                      <span>
                        {isRegister
                          ? "Já tem uma conta?"
                          : isRecover
                            ? "Lembrou sua senha?"
                            : "Ainda não tem conta?"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          changeView(
                            isRegister || isRecover ? "login" : "register",
                          )
                        }
                      >
                        {isRegister || isRecover ? "Entrar" : "Criar conta"}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.section>

          <motion.aside
            className="auth-visual"
            aria-label={
              isRegister
                ? "Sala com sofá Maximo da Império Sofás"
                : "Sala com sofá Berlim da Império Sofás"
            }
          >
            <motion.div
              className="auth-visual-photo"
              aria-hidden="true"
              initial={false}
              animate={{
                opacity: isRegister ? 0 : 1,
                x: isCompactViewport && !reduceMotion && isRegister ? -14 : 0,
                y: isCompactViewport && !reduceMotion && isRegister ? -10 : 0,
                scale:
                  isCompactViewport && !reduceMotion && isRegister ? 1.04 : 1,
              }}
              transition={{
                duration: reduceMotion ? 0 : 0.55,
                ease: "easeInOut",
              }}
            >
              <Image
                src={sofa}
                alt=""
                fill
                sizes="(min-width: 900px) 50vw, 100vw"
                priority
                className="auth-visual-image"
              />
            </motion.div>
            <motion.div
              className="auth-visual-photo"
              aria-hidden="true"
              initial={false}
              animate={{
                opacity: isRegister ? 1 : 0,
                x: isCompactViewport && !reduceMotion && !isRegister ? 14 : 0,
                y: isCompactViewport && !reduceMotion && !isRegister ? 10 : 0,
                scale:
                  isCompactViewport && !reduceMotion && !isRegister ? 1.04 : 1,
              }}
              transition={{
                duration: reduceMotion ? 0 : 0.55,
                ease: "easeInOut",
              }}
            >
              <Image
                src={signupSofa}
                alt=""
                fill
                sizes="(min-width: 900px) 50vw, 100vw"
                loading="eager"
                className="auth-visual-image auth-visual-image--register"
              />
            </motion.div>
            <div className="auth-visual-shade" />
            <div className="auth-visual-top">
              <Brand className="auth-brand-light" />
              <Link href="/loja/sofas" className="auth-back-link">
                Voltar à loja <ArrowRight size={15} />
              </Link>
            </div>
            <div className="auth-visual-copy">
              <p className="auth-visual-title">
                {isRegister ? (
                  <>
                    Uma casa
                    <br />
                    <em>mais sua.</em>
                  </>
                ) : (
                  <>
                    Um lugar seu.
                    <br />
                    <em>Do seu jeito.</em>
                  </>
                )}
              </p>
              <p className="auth-visual-description">
                {isRegister
                  ? "Comece a descobrir o conforto que combina com você."
                  : "A casa muda quando a gente encontra o lugar certo para ficar."}
              </p>
            </div>
          </motion.aside>
          <motion.div
            className={`auth-shutter auth-shutter--${transitionDirection}`}
            aria-hidden="true"
            initial={false}
            animate={
              isCompactViewport
                ? { scaleY: transitionPhase === "cover" ? 1 : 0 }
                : { scaleX: transitionPhase === "cover" ? 1 : 0 }
            }
            style={{
              transformOrigin: isCompactViewport
                ? `center ${transitionDirection === "forward" ? "top" : "bottom"}`
                : `${transitionDirection === "forward" ? "left" : "right"} center`,
            }}
            transition={{
              duration:
                reduceMotion || transitionPhase === "idle"
                  ? 0
                  : transitionPhase === "cover"
                    ? 0.3
                    : 0.34,
              ease: [0.72, 0, 0.28, 1] as const,
            }}
            onAnimationComplete={handleShutterAnimationComplete}
          />
        </motion.div>
      </div>
    </main>
  );
}
