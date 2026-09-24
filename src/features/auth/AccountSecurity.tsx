"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { OtpCodeInput } from "./OtpCodeInput";

type TotpFactor = {
  id: string;
  status: "verified" | "unverified";
  friendly_name?: string;
};

export function AccountSecurity() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadFactors() {
    if (!supabase) return;
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError("Não foi possível carregar os métodos de segurança.");
      return;
    }
    setFactor(data.totp.find((item) => item.status === "verified") ?? null);
  }

  useEffect(() => {
    let active = true;
    if (supabase) {
      void supabase.auth.mfa
        .listFactors()
        .then(({ data, error: listError }) => {
          if (!active) return;
          if (listError)
            setError("Não foi possível carregar os métodos de segurança.");
          else
            setFactor(
              data.totp.find((item) => item.status === "verified") ?? null,
            );
        });
    }
    return () => {
      active = false;
    };
  }, [supabase]);

  async function beginSetup() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Império Sofás",
    });
    setBusy(false);
    if (enrollError) {
      setError("Não foi possível iniciar a configuração. Tente novamente.");
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setCode("");
  }

  async function verifySetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || code.length !== 6) {
      setError("Informe os seis dígitos do seu autenticador.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setBusy(false);
      setError("Não foi possível validar o código agora. Tente de novo.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    setBusy(false);
    if (verifyError) {
      setError(
        "Código incorreto ou expirado. Confira o relógio do celular e tente novamente.",
      );
      return;
    }
    setQrCode("");
    setSecret("");
    setCode("");
    setMessage("App autenticador ativado para esta conta.");
    await loadFactors();
  }

  async function disableFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !factor || code.length !== 6) {
      setError("Informe o código atual do autenticador para continuar.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError || !challenge) {
      setBusy(false);
      setError("Não foi possível verificar sua identidade. Tente novamente.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setBusy(false);
      setError("Código incorreto ou expirado.");
      return;
    }
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: factor.id,
    });
    setBusy(false);
    if (unenrollError) {
      setError(
        "A verificação passou, mas não foi possível remover o autenticador.",
      );
      return;
    }
    setFactor(null);
    setCode("");
    setMessage("Verificação em duas etapas desativada.");
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setMessage("Chave copiada. Guarde-a apenas no seu autenticador.");
    } catch {
      setError(
        "Não foi possível copiar. Selecione e copie a chave manualmente.",
      );
    }
  }

  return (
    <main className="account-page">
      <div className="account-shell account-security-shell">
        <Link href="/conta" className="security-back">
          <ArrowLeft size={16} /> Minha conta
        </Link>
        <section className="security-heading">
          <span className="account-card-icon">
            <ShieldCheck size={23} />
          </span>
          <span className="auth-overline">SEGURANÇA DA CONTA</span>
          <h1 className="account-title">Uma camada a mais de proteção.</h1>
          <p className="account-copy">
            Use um aplicativo autenticador, como 1Password, Google Authenticator
            ou Microsoft Authenticator, para gerar códigos temporários.
          </p>
        </section>
        <section className="security-panel">
          <div className="security-status">
            <div>
              <span className="account-card-label">APP AUTENTICADOR</span>
              <h2>
                {factor ? "Verificação ativada" : "Ainda não configurado"}
              </h2>
              <p>
                {factor
                  ? "Um código de uso único será solicitado durante o acesso."
                  : "A configuração leva cerca de um minuto e funciona sem SMS."}
              </p>
            </div>
            <span className={factor ? "security-pill is-on" : "security-pill"}>
              {factor ? "PROTEGIDO" : "OPCIONAL"}
            </span>
          </div>

          {qrCode ? (
            <div className="security-enroll">
              <div className="security-steps">
                <p>
                  <b>01</b> Abra o app autenticador e escaneie este QR.
                </p>
                <div className="security-qr">
                  <Image
                    src={qrCode}
                    alt="QR para configurar o app autenticador"
                    width={190}
                    height={190}
                    unoptimized
                  />
                </div>
                <p>
                  Se estiver configurando no mesmo celular, copie a chave
                  manual:
                </p>
                <div className="security-secret">
                  <code>{secret}</code>
                  <button
                    type="button"
                    aria-label="Copiar chave manual"
                    onClick={() => void copySecret()}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
              <form
                className="auth-form security-verify"
                onSubmit={verifySetup}
              >
                <label className="auth-label" htmlFor="totp-enroll-code">
                  02 · Digite o código mostrado no app
                </label>
                <p id="totp-enroll-code-help" className="auth-helper">
                  Digite ou cole os seis números do app autenticador.
                </p>
                <OtpCodeInput
                  id="totp-enroll-code"
                  value={code}
                  onChange={setCode}
                  invalid={Boolean(error)}
                  disabled={busy}
                  describedBy={error ? "auth-error" : "totp-enroll-code-help"}
                />
                {error && (
                  <p className="auth-alert" id="auth-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="auth-submit"
                  disabled={busy || code.length !== 6}
                >
                  {busy ? "Verificando…" : "Ativar verificação"}
                  <Check size={17} />
                </button>
                <button
                  type="button"
                  className="auth-text-button"
                  onClick={() => {
                    setQrCode("");
                    setSecret("");
                    setError(null);
                  }}
                >
                  Cancelar configuração
                </button>
              </form>
            </div>
          ) : factor ? (
            <form className="security-disable" onSubmit={disableFactor}>
              <label className="auth-label" htmlFor="totp-disable-code">
                Para desativar, confirme com o código atual
              </label>
              <p id="totp-disable-code-help" className="auth-helper">
                Digite ou cole os seis números do app autenticador.
              </p>
              <OtpCodeInput
                id="totp-disable-code"
                value={code}
                onChange={setCode}
                invalid={Boolean(error)}
                disabled={busy}
                describedBy={error ? "auth-error" : "totp-disable-code-help"}
              />
              {error && (
                <p className="auth-alert" id="auth-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="security-disable-button"
                disabled={busy || code.length !== 6}
              >
                {busy ? "Confirmando…" : "Desativar app autenticador"}
              </button>
            </form>
          ) : (
            <button
              className="auth-submit security-start"
              type="button"
              onClick={() => void beginSetup()}
              disabled={busy}
            >
              {busy ? "Preparando…" : "Configurar app autenticador"}
              <ArrowRight size={17} />
            </button>
          )}
          {error && !qrCode && (
            <p className="auth-alert" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="security-message" role="status">
              <Check size={16} />
              {message}
            </p>
          )}
        </section>
        <p className="security-footnote">
          <KeyRound size={14} /> Guarde a chave de configuração em local seguro
          enquanto adiciona a conta ao aplicativo.
        </p>
      </div>
    </main>
  );
}
