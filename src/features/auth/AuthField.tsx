import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import styles from "./auth-experience.module.css";

type AuthFieldProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "className" | "id" | "onChange" | "value"
> & {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  leadingIcon?: ReactNode;
  labelAction?: ReactNode;
  trailingAction?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

export function AuthField({
  id,
  label,
  value,
  onChange,
  inputRef,
  leadingIcon,
  labelAction,
  trailingAction,
  hint,
  error,
  ...inputProps
}: AuthFieldProps) {
  const describedBy = [
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
    inputProps["aria-describedby"],
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      <div className={labelAction ? styles.labelRow : undefined}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        {labelAction}
      </div>
      <div className={styles.inputShell}>
        {leadingIcon && (
          <span className={styles.leadingIcon} aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        <input
          {...inputProps}
          id={id}
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy || undefined}
          aria-invalid={
            Boolean(error) || inputProps["aria-invalid"] || undefined
          }
        />
        {trailingAction && (
          <span className={styles.trailingAction}>{trailingAction}</span>
        )}
      </div>
      {hint && (
        <span id={`${id}-hint`} className={styles.helper}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
