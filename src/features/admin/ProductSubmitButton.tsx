"use client";

import type { ReactNode } from "react";
import { useProductSubmission } from "./ProductDetailsForm";

export function ProductSubmitButton({
  name,
  value,
  className,
  pendingLabel,
  blocked = false,
  children,
}: {
  name: string;
  value: string;
  className: string;
  pendingLabel: string;
  blocked?: boolean;
  children: ReactNode;
}) {
  const pendingIntent = useProductSubmission();
  const pending = pendingIntent !== null;

  return (
    <button
      className={className}
      name={name}
      value={value}
      type="submit"
      disabled={pending || blocked}
      aria-busy={pending}
    >
      {pendingIntent === value ? pendingLabel : children}
    </button>
  );
}
