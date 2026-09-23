"use client";

import { useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import sofa from "../../assets/products/berlim-enhanced-800.webp";
import { Brand } from "../../components/Brand";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";

type View = "login" | "register" | "recover" | "mfa" | "sent";

function CodeField({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  return (
    <div className="auth-code-wrap">
      <div className="auth-code-slots" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={index === value.length ? "is-active" : ""}
          >
            {value[index] ?? ""}
          </span>
        ))}
      </div>
      <input
        id={id}
        className="auth-code-input"
        aria-label="Código de seis dígitos do app autenticador"
        aria-describedby={invalid ? "auth-error" : "auth-code-help"}
        aria-invalid={invalid}
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        autoFocus
      />
    </div>
  );
}

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
  const isLogin = view === "login";
  const isRegister = view === "register";
  const isRecover = view === "recover";
  const isMfa = view === "mfa";

  function changeView(next: View) {
    setError(null);
    setNotice(null);
    setView(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!isConfigured || !supabase) {
      setError(
        "A autenticação ainda não está conectada ao Supabase deste projeto.",
      );
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

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
          setView("mfa");
          setPassword("");
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
            emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fconta`,
          },
        });
        if (signUpError)
          throw new Error(
            "Não foi possível iniciar o cadastro. Confira os dados e tente novamente.",
          );
        setView("sent");
        setNotice(
          "Se o cadastro puder ser concluído, enviaremos um link de confirmação para este e-mail.",
        );
        return;
      }

      if (isRecover) {
        const { error: recoveryError } =
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?next=%2Fconta%2Fredefinir-senha`,
          });
        if (recoveryError)
          throw new Error(
            "Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.",
          );
        setView("sent");
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
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!supabase || code.length !== 6) {
      setError("Digite os seis números do app autenticador.");
      return;
    }
    setBusy(true);
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });
    setBusy(false);
    if (verifyError) {
      setCode("");
      setError(
        "Código inválido ou expirado. Confira o app autenticador e tente de novo.",
      );
      return;
    }
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
        <div className="auth-card">
          <section className="auth-form-panel">
            <div className="auth-form-head">
              <span className="auth-kicker">
                IMPÉRIO SOFÁS · VALE DO PARAÍBA
              </span>
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, y: 8, clipPath: "inset(0 0 100% 0)" }}
                  animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
                  exit={{ opacity: 0, y: -6, clipPath: "inset(100% 0 0 0)" }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <p className="auth-overline">
                    {isMfa
                      ? "SEGURANÇA EM DUAS ETAPAS"
                      : isRegister
                        ? "CRIE SUA CONTA"
                        : isRecover
                          ? "ACESSO À CONTA"
                          : isLogin
                            ? "BEM-VINDO DE VOLTA"
                            : "QUASE LÁ"}
                  </p>
                  <h1 className="auth-title">{title}</h1>
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
            {!isConfigured && (
              <p className="auth-config-note" role="status">
                <span>
                  <LockKeyhole size={16} />
                </span>
                O acesso real será ativado quando o Supabase deste projeto
                estiver configurado.
              </p>
            )}

            <AnimatePresence mode="wait">
              {view === "sent" ? (
                <motion.div
                  key="sent"
                  className="auth-sent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <label className="auth-label" htmlFor="auth-code">
                    Código do app autenticador
                  </label>
                  <CodeField
                    id="auth-code"
                    value={code}
                    onChange={setCode}
                    invalid={Boolean(error)}
                  />
                  <p id="auth-code-help" className="auth-helper">
                    Abra seu autenticador e use o código de 6 dígitos. Não é um
                    código por SMS.
                  </p>
                  {error && (
                    <p className="auth-alert" id="auth-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    className="auth-submit"
                    type="submit"
                    disabled={busy || code.length !== 6}
                  >
                    {busy ? "Verificando…" : "Verificar e continuar"}
                    <ArrowRight size={17} />
                  </button>
                  <button
                    type="button"
                    className="auth-text-button"
                    onClick={() => {
                      void supabase?.auth.signOut();
                      changeView("login");
                    }}
                  >
                    Voltar ao login
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key={view}
                  className="auth-form"
                  onSubmit={submit}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {isRegister && (
                    <div className="auth-field">
                      <label className="auth-label" htmlFor="auth-name">
                        Como podemos chamar você?
                      </label>
                      <input
                        id="auth-name"
                        className="auth-input"
                        type="text"
                        autoComplete="name"
                        maxLength={100}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="auth-email">
                      E-mail
                    </label>
                    <input
                      id="auth-email"
                      className="auth-input"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                  {!isRecover && (
                    <div className="auth-field">
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
                          minLength={isRegister ? 12 : undefined}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="auth-show-password"
                          aria-label={
                            showPassword ? "Ocultar senha" : "Mostrar senha"
                          }
                          onClick={() => setShowPassword((visible) => !visible)}
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  {isRegister && (
                    <div className="auth-field">
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
                        minLength={12}
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        required
                      />
                      <p className="auth-helper">
                        Use pelo menos 12 caracteres.
                      </p>
                    </div>
                  )}
                  {error && (
                    <p className="auth-alert" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    className="auth-submit"
                    type="submit"
                    disabled={busy || !isConfigured}
                  >
                    {busy
                      ? "Aguarde…"
                      : isRegister
                        ? "Criar minha conta"
                        : isRecover
                          ? "Enviar instruções"
                          : "Entrar na minha conta"}
                    {!busy && <ArrowRight size={17} />}
                  </button>
                  {isRegister && (
                    <p className="auth-legal">
                      Cadastro por e-mail com confirmação e senha gerenciada
                      pelo Supabase Auth.
                    </p>
                  )}
                </motion.form>
              )}
            </AnimatePresence>

            {view !== "mfa" && view !== "sent" && (
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
                    changeView(isRegister || isRecover ? "login" : "register")
                  }
                >
                  {isRegister || isRecover ? "Entrar" : "Criar conta"}
                </button>
              </div>
            )}
          </section>

          <aside
            className="auth-visual"
            aria-label="Ambiente de estar com sofá Império"
          >
            <Image
              src={sofa}
              alt="Sofá de linhas contemporâneas em uma sala acolhedora"
              fill
              sizes="(min-width: 900px) 50vw, 100vw"
              priority
              className="auth-visual-image"
            />
            <div className="auth-visual-shade" />
            <div className="auth-visual-top">
              <Brand className="auth-brand-light" />
              <Link href="/loja/sofas" className="auth-back-link">
                Voltar à loja <ArrowRight size={15} />
              </Link>
            </div>
            <div className="auth-visual-copy">
              <span className="auth-visual-rule" />
              <p className="auth-visual-eyebrow">
                O conforto mora nos detalhes
              </p>
              <p className="auth-visual-title">
                Um lugar seu.
                <br />
                <em>Do seu jeito.</em>
              </p>
              <p className="auth-visual-description">
                A casa muda quando a gente encontra o lugar certo para ficar.
              </p>
            </div>
            <div className="auth-visual-footer">
              <KeyRound size={15} />
              <span>Seus dados, tratados com cuidado.</span>
            </div>
            <span className="auth-edition">EST. VALE DO PARAÍBA</span>
          </aside>
        </div>
        <p className="auth-footer">
          Atendimento próximo, em cada etapa.{" "}
          <Link href="/loja/sofas">
            Conheça a coleção <ArrowRight size={13} />
          </Link>
        </p>
      </div>
    </main>
  );
}
