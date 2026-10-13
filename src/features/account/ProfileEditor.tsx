"use client";

import { useState, type FormEvent } from "react";
import { Check, Mail, Save } from "lucide-react";
import { AuthField } from "../auth/AuthField";
import { saveCustomerProfile } from "./actions";
import styles from "./account.module.css";

export function ProfileEditor({
  displayName,
  contactPhone,
  email,
}: {
  displayName: string | null;
  contactPhone: string | null;
  email: string;
}) {
  const [name, setName] = useState(displayName ?? "");
  const [phone, setPhone] = useState(contactPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const formData = new FormData();
    formData.set("displayName", name);
    formData.set("contactPhone", phone);
    try {
      const result = await saveCustomerProfile(formData);
      setStatus(result);
    } catch {
      setStatus({
        ok: false,
        message: "Não foi possível salvar seus dados agora.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeading}>
        <span className={styles.overline}>SEUS DADOS</span>
        <h2>Dados pessoais</h2>
        <p>Use um nome e telefone para facilitar nosso atendimento.</p>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <AuthField
          id="profile-name"
          name="displayName"
          label="Como podemos chamar você?"
          autoComplete="name"
          maxLength={80}
          value={name}
          onChange={setName}
        />
        <AuthField
          id="profile-phone"
          name="contactPhone"
          label="Telefone para contato"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="(12) 98888-7777"
          hint="Somente para contato. Não altera o telefone de autenticação."
          value={phone}
          onChange={setPhone}
        />
        <div className={styles.emailRow}>
          <span className={styles.emailIcon}>
            <Mail size={18} />
          </span>
          <span>
            <small>E-MAIL DA CONTA</small>
            <strong>{email}</strong>
          </span>
          <a href="/conta/seguranca#email">Alterar</a>
        </div>
        {status ? (
          <p
            className={status.ok ? styles.success : styles.error}
            role={status.ok ? "status" : "alert"}
          >
            {status.ok ? <Check size={16} /> : null}
            {status.message}
          </p>
        ) : null}
        <button className={styles.submit} disabled={busy}>
          {busy ? "Salvando…" : "Salvar alterações"}
          <Save size={17} />
        </button>
      </form>
    </div>
  );
}
