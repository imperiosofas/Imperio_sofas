"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { AuthField } from "./AuthField";
import styles from "../account/account.module.css";

function authMessage(error: { code?: string; message?: string }) {
  switch (error.code) {
    case "invalid_credentials":
      return "A senha atual não confere.";
    case "weak_password":
      return "Escolha uma senha que atenda aos critérios informados pelo serviço.";
    case "same_password":
      return "A nova senha precisa ser diferente da atual.";
    case "reauthentication_needed":
      return "Por segurança, confirme sua identidade pelo e-mail da conta.";
    case "reauth_nonce_missing":
      return "Informe o código enviado para confirmar esta alteração.";
    case "reauthentication_not_valid":
      return "O código não é válido. Confira a mensagem recebida e tente novamente.";
    default:
      return error.message?.toLowerCase().includes("password")
        ? "Não foi possível alterar a senha. Confira os dados e tente novamente."
        : "Não foi possível concluir a solicitação agora. Tente novamente.";
  }
}

export function AccountSecurity({
  email,
  pendingEmail,
}: {
  email: string;
  pendingEmail: string | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reauthCode, setReauthCode] = useState("");
  const [needsReauthCode, setNeedsReauthCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailFeedback(null);
    if (!supabase)
      return setEmailFeedback({
        ok: false,
        text: "Serviço de conta indisponível.",
      });
    if (newEmail.trim().toLowerCase() === email.toLowerCase()) {
      return setEmailFeedback({
        ok: false,
        text: "Digite um endereço diferente do e-mail atual.",
      });
    }
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/conta/seguranca")}`;
      const { data, error } = await supabase.auth.updateUser(
        { email: newEmail.trim() },
        { emailRedirectTo: redirectTo },
      );
      if (error) setEmailFeedback({ ok: false, text: authMessage(error) });
      else {
        setNewEmail("");
        setEmailFeedback({
          ok: true,
          text: data.user?.new_email
            ? `Solicitação enviada para ${data.user.new_email}. A alteração só termina após a confirmação solicitada pelo Supabase.`
            : "Solicitação processada pelo Supabase. Siga as instruções de confirmação enviadas por e-mail; a tela não considera o endereço alterado antes disso.",
        });
      }
    } catch {
      setEmailFeedback({
        ok: false,
        text: "Não foi possível enviar a solicitação. Confira sua conexão e tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordFeedback(null);
    if (!supabase)
      return setPasswordFeedback({
        ok: false,
        text: "Serviço de conta indisponível.",
      });
    if (newPassword !== confirmation)
      return setPasswordFeedback({
        ok: false,
        text: "A confirmação não corresponde à nova senha.",
      });
    if (!currentPassword || !newPassword)
      return setPasswordFeedback({
        ok: false,
        text: "Preencha a senha atual e a nova senha.",
      });
    setBusy(true);
    try {
      if (needsReauthCode) {
        if (!reauthCode.trim()) {
          setPasswordFeedback({
            ok: false,
            text: "Digite o código de confirmação enviado pelo Supabase.",
          });
          return;
        }
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
          current_password: currentPassword,
          nonce: reauthCode.trim(),
        });
        if (error) setPasswordFeedback({ ok: false, text: authMessage(error) });
        else {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmation("");
          setReauthCode("");
          setNeedsReauthCode(false);
          setPasswordFeedback({
            ok: true,
            text: "Senha alterada com sucesso.",
          });
        }
        return;
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });
      if (error?.code === "reauthentication_needed") {
        const { error: reauthError } = await supabase.auth.reauthenticate();
        if (reauthError)
          setPasswordFeedback({ ok: false, text: authMessage(reauthError) });
        else {
          setNeedsReauthCode(true);
          setPasswordFeedback({
            ok: true,
            text: "O Supabase solicitou uma confirmação adicional. Verifique o e-mail da conta e informe o código abaixo.",
          });
        }
      } else if (error)
        setPasswordFeedback({ ok: false, text: authMessage(error) });
      else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmation("");
        setPasswordFeedback({ ok: true, text: "Senha alterada com sucesso." });
      }
    } catch {
      setPasswordFeedback({
        ok: false,
        text: "Não foi possível alterar a senha agora. Tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.securityStack}>
      <section id="email" className={styles.panel}>
        <div className={styles.panelHeading}>
          <span className={styles.overline}>E-MAIL DA CONTA</span>
          <h2>Seu e-mail de acesso</h2>
          <p>
            O endereço atual é <strong>{email}</strong>. A alteração segue o
            fluxo de confirmação oficial do Supabase.
          </p>
        </div>
        {pendingEmail ? (
          <p className={styles.pending}>
            <Mail size={16} /> Existe uma alteração pendente para{" "}
            <strong>{pendingEmail}</strong>. Confirme pelo e-mail recebido para
            concluir.
          </p>
        ) : null}
        <form
          className={styles.form}
          onSubmit={(event) => void changeEmail(event)}
        >
          <AuthField
            id="account-new-email"
            name="newEmail"
            label="Novo e-mail"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            required
            value={newEmail}
            onChange={setNewEmail}
          />
          <button className={styles.submit} disabled={busy}>
            {busy ? "Enviando…" : "Solicitar alteração de e-mail"}
            <Mail size={17} />
          </button>
        </form>
        {emailFeedback ? (
          <p
            className={emailFeedback.ok ? styles.success : styles.error}
            role={emailFeedback.ok ? "status" : "alert"}
          >
            {emailFeedback.ok ? <Check size={16} /> : null}
            {emailFeedback.text}
          </p>
        ) : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <span className={styles.overline}>SENHA</span>
          <h2>Atualize sua senha</h2>
          <p>
            Confirme sua senha atual. Os critérios da nova senha são validados
            pelo próprio Supabase.
          </p>
        </div>
        <form
          className={styles.form}
          onSubmit={(event) => void changePassword(event)}
        >
          <AuthField
            id="account-current-password"
            name="currentPassword"
            label="Senha atual"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <AuthField
            id="account-new-password"
            name="newPassword"
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={setNewPassword}
          />
          <AuthField
            id="account-confirm-password"
            name="confirmPassword"
            label="Confirme a nova senha"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={setConfirmation}
          />
          {needsReauthCode ? (
            <AuthField
              id="account-reauth-code"
              name="reauthCode"
              label="Código de confirmação"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              required
              value={reauthCode}
              onChange={setReauthCode}
              hint="O código é solicitado pelo Supabase quando a sessão precisa ser revalidada."
            />
          ) : null}
          {passwordFeedback ? (
            <p
              className={passwordFeedback.ok ? styles.success : styles.error}
              role={passwordFeedback.ok ? "status" : "alert"}
            >
              {passwordFeedback.ok ? (
                <Check size={16} />
              ) : (
                <ShieldCheck size={16} />
              )}
              {passwordFeedback.text}
            </p>
          ) : null}
          <button className={styles.submit} disabled={busy}>
            {busy
              ? "Processando…"
              : needsReauthCode
                ? "Confirmar e alterar senha"
                : "Alterar senha"}
            <KeyRound size={17} />
          </button>
        </form>
      </section>
    </div>
  );
}
