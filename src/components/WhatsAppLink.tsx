import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { buildWhatsAppUrl, WHATSAPP_NUMBERS } from '../config'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { message: string; children: ReactNode }

let nextSellerIndex = 0

export function WhatsAppLink({ message, children, ...props }: Props) {
  const handleClick: NonNullable<AnchorHTMLAttributes<HTMLAnchorElement>['onClick']> = (event) => {
    props.onClick?.(event)
    if (event.defaultPrevented) return
    const number = WHATSAPP_NUMBERS[nextSellerIndex]
    nextSellerIndex = (nextSellerIndex + 1) % WHATSAPP_NUMBERS.length
    event.currentTarget.href = buildWhatsAppUrl(message, number)
  }

  return <a href={buildWhatsAppUrl(message)} target="_blank" rel="noreferrer" {...props} onClick={handleClick}>{children}</a>
}
