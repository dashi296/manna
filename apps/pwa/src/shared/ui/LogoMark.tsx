type Props = {
  className?: string
  alt?: string
}

export function LogoMark({ className, alt = '' }: Props) {
  return (
    <picture>
      <source srcSet="/logo-mark-dark.png" media="(prefers-color-scheme: dark)" />
      <img src="/logo-mark-light.png" alt={alt} className={className} />
    </picture>
  )
}
