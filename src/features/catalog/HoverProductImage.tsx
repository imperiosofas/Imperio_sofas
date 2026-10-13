"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";

const hoverPointerQuery = "(hover: hover) and (pointer: fine)";

function subscribeToHoverPointer(onChange: () => void) {
  const mediaQuery = window.matchMedia(hoverPointerQuery);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getHoverPointerSnapshot() {
  return window.matchMedia(hoverPointerQuery).matches;
}

function getServerSnapshot() {
  return false;
}

export function HoverProductImage({
  src,
  sizes,
  className,
}: {
  src: string;
  sizes: string;
  className: string;
}) {
  const supportsHoverPointer = useSyncExternalStore(
    subscribeToHoverPointer,
    getHoverPointerSnapshot,
    getServerSnapshot,
  );

  if (!supportsHoverPointer) return null;

  return (
    <Image
      src={src}
      alt=""
      fill
      unoptimized
      sizes={sizes}
      className={className}
    />
  );
}
