import type { ReactNode } from "react";
import { AlertCircle, Check, CircleHelp, PackageOpen } from "lucide-react";
import type { LogisticsReadIssue } from "./types";
import styles from "./logistics.module.css";

export function LogisticsPage({
  eyebrow = "Operação comercial",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.page}>
      <header className={styles.pageHeading}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className={styles.lede}>{description}</p>
      </header>
      {children}
    </section>
  );
}

export function LogisticsPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function LogisticsReadNotice({
  issue,
  rpc,
}: {
  issue: LogisticsReadIssue;
  rpc: string;
}) {
  const isMissing = issue === "rpc_missing";
  const isInvalid = issue === "shape_mismatch";
  return (
    <div className={styles.readNotice} role="alert">
      {isMissing ? (
        <CircleHelp size={18} aria-hidden="true" />
      ) : (
        <AlertCircle size={18} aria-hidden="true" />
      )}
      <div>
        <strong>
          {isMissing
            ? "Contrato administrativo ainda não disponível"
            : isInvalid
              ? "A resposta da logística não corresponde ao contrato esperado"
              : "Não foi possível consultar os dados de logística"}
        </strong>
        <p>
          {isMissing
            ? `A RPC ${rpc} ainda não está exposta neste banco. Nenhum indicador ou registro foi simulado; a página será preenchida quando o contrato administrativo estiver aplicado.`
            : isInvalid
              ? `A RPC ${rpc} respondeu, mas os campos recebidos não passaram pela validação da interface. Nenhum dado parcial foi apresentado.`
              : `A consulta ${rpc} falhou. Atualize a página e, se o problema persistir, verifique o acesso administrativo no banco.`}
        </p>
      </div>
    </div>
  );
}

export function LogisticsFeedback({
  result,
  subject,
}: {
  result?: string;
  subject: string;
}) {
  if (!result) return null;
  if (result === "saved") {
    return (
      <p className={styles.feedbackSuccess} role="status">
        <Check size={16} aria-hidden="true" /> {subject} atualizado.
      </p>
    );
  }
  const message =
    result === "invalid"
      ? "Revise os campos. Nenhuma alteração foi enviada."
      : result === "policy"
        ? "A alteração conflita com uma regra operacional confirmada."
        : result === "rpc"
          ? "A ação não está disponível no contrato RPC aplicado. Nenhum dado foi alterado."
          : "Não foi possível salvar. Nenhuma confirmação foi recebida do servidor.";
  return (
    <p className={styles.feedbackError} role="alert">
      <AlertCircle size={16} aria-hidden="true" /> {message}
    </p>
  );
}

export function LogisticsEmpty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <PackageOpen size={22} strokeWidth={1.6} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function DataValue({ children }: { children: ReactNode }) {
  return <span className={styles.dataValue}>{children}</span>;
}
