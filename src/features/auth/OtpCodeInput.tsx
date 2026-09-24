"use client";

import { useState, type Ref } from "react";

export function OtpCodeInput({
  id,
  value,
  onChange,
  invalid = false,
  disabled = false,
  describedBy,
  inputRef,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={`auth-code-wrap${focused ? " is-focused" : ""}${invalid ? " is-invalid" : ""}${disabled ? " is-disabled" : ""}`}
    >
      <div className="auth-code-slots" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={[
              index < value.length ? "has-value" : "",
              index === value.length && focused ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {value[index] ?? ""}
          </span>
        ))}
      </div>
      <input
        id={id}
        ref={inputRef}
        className="auth-code-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        maxLength={6}
        value={value}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
      />
    </div>
  );
}
