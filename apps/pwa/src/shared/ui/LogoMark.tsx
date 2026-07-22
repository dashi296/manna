type Props = {
  className?: string
  alt?: string
}

export function LogoMark({ className, alt = '' }: Props) {
  return <img src="/logo-mark.svg" alt={alt} className={className} />
}
