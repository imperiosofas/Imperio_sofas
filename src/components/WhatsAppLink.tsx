import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { buildWhatsAppUrl } from '../config'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { message: string; children: ReactNode }

export function WhatsAppLink({ message, children, ...props }: Props) {
  return <a href={buildWhatsAppUrl(message)} target="_blank" rel="noreferrer" {...props}>{children}</a>
}
