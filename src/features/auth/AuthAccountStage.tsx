"use client";

import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
} from "lucide-react";
import { useRef, type FormEvent, type RefObject } from "react";
import { AuthField } from "./AuthField";
import styles from "./auth-experience.module.css";

export type AccountMode = "login" | "register";
export type AuthStep = "email" | "password";
export type OAuthProvider = "google" | "apple";

type Props = {
  mode: AccountMode;
  step: AuthStep;
  email: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  busy: boolean;
  busyProvider: OAuthProvider | null;
  error: string | null;
  googleEnabled: boolean;
  appleEnabled: boolean;
  emailInputRef: RefObject<HTMLInputElement | null>;
  passwordInputRef: RefObject<HTMLInputElement | null>;
  onModeChange: (mode: AccountMode) => void;
  onStepChange: (step: AuthStep) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onShowPasswordChange: () => void;
  onContinueWithEmail: (event: FormEvent<HTMLFormElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRecover: () => void;
  onOAuth: (provider: OAuthProvider) => void;
};

const stepVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 12 : -12,
    y: direction > 0 ? 5 : -3,
    clipPath: direction > 0 ? "inset(0 0 0 8%)" : "inset(0 8% 0 0)",
  }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    clipPath: "inset(0 0 0 0)",
    transition: { duration: 0.23, ease: [0.22, 0.72, 0.22, 1] },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -7 : 7,
    y: direction > 0 ? -3 : 4,
    transition: { duration: 0.12, ease: "easeIn" },
  }),
};

function SocialButton({
  provider,
  busy,
  active,
  onClick,
}: {
  provider: OAuthProvider;
  busy: boolean;
  active: boolean;
  onClick: () => void;
}) {
  if (provider === "apple") {
    return (
      <button
        className={`${styles.socialButton} ${styles.appleButton}`}
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-label="Continuar com Apple"
        aria-busy={active}
      >
        <Image
          src="/auth/apple-continue-pt-br.png"
          alt=""
          width={750}
          height={112}
          className={styles.appleArtwork}
        />
        {active && <LoaderCircle className={styles.socialLoader} size={18} />}
      </button>
    );
  }

  return (
    <button
      className={`${styles.socialButton} ${styles.googleButton}`}
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={active}
    >
      <Image
        src="/auth/google-g.png"
        alt=""
        width={20}
        height={20}
        className={styles.googleMark}
      />
      <span>Continuar com Google</span>
      {active && <LoaderCircle className={styles.socialLoader} size={18} />}
    </button>
  );
}

export function AuthAccountStage({
  mode,
  step,
  email,
  password,
  confirmPassword,
  showPassword,
  busy,
  busyProvider,
  error,
  googleEnabled,
  appleEnabled,
  emailInputRef,
  passwordInputRef,
  onModeChange,
  onStepChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onShowPasswordChange,
  onContinueWithEmail,
  onSubmit,
  onRecover,
  onOAuth,
}: Props) {
  const reducedMotion = Boolean(useReducedMotion());
  const previousStepRef = useRef(step);
  const direction = step === "password" ? 1 : -1;
  const hasSocialProviders = googleEnabled || appleEnabled;
  const errorId = "auth-stage-error";
  const animationVariants = reducedMotion
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1, transition: { duration: 0.1 } },
        exit: { opacity: 0, transition: { duration: 0.08 } },
      }
    : stepVariants;

  function focusCurrentStep() {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    const field = step === "password" ? passwordInputRef : emailInputRef;
    field.current?.focus({ preventScroll: true });
  }

  return (
    <div
      className={styles.accountStage}
      data-auth-stage
      data-auth-mode={mode}
      data-auth-step={step}
      aria-busy={busy || undefined}
    >
      <AnimatePresence initial={false} custom={direction}>
        {step === "email" && hasSocialProviders && (
          <motion.div
            key="social-first"
            className={styles.socialStage}
            variants={animationVariants}
            custom={direction}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <div
              className={styles.socialGroup}
              role="group"
              aria-label="Entrar com"
            >
              {googleEnabled && (
                <SocialButton
                  provider="google"
                  busy={busy}
                  active={busyProvider === "google"}
                  onClick={() => onOAuth("google")}
                />
              )}
              {appleEnabled && (
                <SocialButton
                  provider="apple"
                  busy={busy}
                  active={busyProvider === "apple"}
                  onClick={() => onOAuth("apple")}
                />
              )}
            </div>
            <div className={styles.divider}>
              <span aria-hidden="true" />
              <span className={styles.dividerLabel}>
                ou continue com e-mail
              </span>
              <span aria-hidden="true" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.stepViewport}>
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          {step === "email" ? (
            <motion.form
              key="email-step"
              className={styles.form}
              noValidate
              onSubmit={onContinueWithEmail}
              variants={animationVariants}
              custom={direction}
              initial="enter"
              animate="center"
              exit="exit"
              onAnimationComplete={focusCurrentStep}
            >
              <AuthField
                id="auth-email"
                name={mode === "register" ? "email" : "username"}
                label="E-mail"
                type="email"
                inputMode="email"
                autoComplete={mode === "register" ? "email" : "username"}
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                value={email}
                onChange={onEmailChange}
                inputRef={emailInputRef}
                leadingIcon={<Mail size={20} strokeWidth={1.65} />}
                aria-describedby={error ? errorId : undefined}
                aria-invalid={Boolean(error)}
                required
              />

              <ErrorMessage
                message={error}
                id={errorId}
                reducedMotion={reducedMotion}
              />

              <motion.button
                className={styles.primaryButton}
                type="submit"
                aria-label="Continuar com e-mail"
                disabled={busy}
                whileTap={reducedMotion ? undefined : { scale: 0.985 }}
              >
                <span>Continuar</span>
                {!busy && <ArrowRight size={19} aria-hidden="true" />}
                {busy && (
                  <span className={styles.buttonSpinner} aria-hidden="true" />
                )}
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="password-step"
              className={styles.form}
              onSubmit={onSubmit}
              variants={animationVariants}
              custom={direction}
              initial="enter"
              animate="center"
              exit="exit"
              onAnimationComplete={focusCurrentStep}
            >
              <div className={styles.emailSummary}>
                <div className={styles.summaryCopy}>
                  <span className={styles.summaryLabel}>E-mail</span>
                  <input
                    id="auth-username"
                    className={styles.summaryValue}
                    type="email"
                    name="username"
                    autoComplete="username"
                    aria-label="E-mail da conta"
                    value={email}
                    readOnly
                  />
                </div>
                <button
                  type="button"
                  className={styles.editEmail}
                  onClick={() => onStepChange("email")}
                  disabled={busy}
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Alterar
                </button>
              </div>

              <AuthField
                id="auth-password"
                name={mode === "register" ? "new-password" : "password"}
                label={mode === "register" ? "Crie sua senha" : "Senha"}
                type={showPassword ? "text" : "password"}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                enterKeyHint={mode === "register" ? "next" : "go"}
                value={password}
                onChange={onPasswordChange}
                inputRef={passwordInputRef}
                aria-describedby={error ? errorId : undefined}
                aria-invalid={Boolean(error)}
                required
                labelAction={
                  mode === "login" ? (
                    <button
                      className={styles.inlineAction}
                      type="button"
                      onClick={onRecover}
                      disabled={busy}
                    >
                      Esqueceu sua senha?
                    </button>
                  ) : undefined
                }
                trailingAction={
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    aria-pressed={showPassword}
                    onClick={onShowPasswordChange}
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

              {mode === "register" && (
                <AuthField
                  id="auth-confirm-password"
                  name="confirm-password"
                  label="Confirme sua senha"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  enterKeyHint="go"
                  value={confirmPassword}
                  onChange={onConfirmPasswordChange}
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={Boolean(error)}
                  required
                />
              )}

              <ErrorMessage
                message={error}
                id={errorId}
                reducedMotion={reducedMotion}
              />

              <motion.button
                className={styles.primaryButton}
                type="submit"
                disabled={busy}
                whileTap={reducedMotion ? undefined : { scale: 0.985 }}
              >
                <span>
                  {busy
                    ? mode === "register"
                      ? "Criando sua conta…"
                      : "Verificando seus dados…"
                    : mode === "register"
                      ? "Criar minha conta"
                      : "Entrar"}
                </span>
                {!busy && <ArrowRight size={19} aria-hidden="true" />}
                {busy && (
                  <span className={styles.buttonSpinner} aria-hidden="true" />
                )}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {step === "email" && (
        <p className={styles.modeFooter}>
          {mode === "login" ? "Ainda não tem uma conta?" : "Já tem uma conta?"}
          <button
            type="button"
            className={styles.modeFooterLink}
            onClick={() =>
              onModeChange(mode === "login" ? "register" : "login")
            }
            disabled={busy}
          >
            {mode === "login" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      )}
    </div>
  );
}

function ErrorMessage({
  message,
  id,
  reducedMotion,
}: {
  message: string | null;
  id: string;
  reducedMotion: boolean;
}) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key={message}
          id={id}
          className={styles.errorMessage}
          role="alert"
          aria-live="assertive"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -2 }}
          transition={{ duration: reducedMotion ? 0.1 : 0.16 }}
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
