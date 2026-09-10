import { useSyncExternalStore } from 'react'
const query = '(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
const getSnapshot = () => window.matchMedia(query).matches
// Efeitos contínuos apenas em desktop com mouse e movimento permitido.
export function useEnhancedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
