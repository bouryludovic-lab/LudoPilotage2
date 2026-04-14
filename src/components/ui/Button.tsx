import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size    = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const BASE = 'inline-flex items-center gap-1.5 font-semibold rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap select-none'

const VARIANTS: Record<Variant, string> = {
  primary:   'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-glow-sm active:scale-95',
  secondary: 'bg-white/8 text-white/75 border border-white/10 hover:bg-white/12 hover:text-white active:scale-95',
  ghost:     'text-white/50 hover:bg-white/6 hover:text-white/85 active:scale-95',
  danger:    'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 active:scale-95',
  outline:   'border border-violet-500/40 text-violet-400 hover:bg-violet-500/10 active:scale-95',
}

const SIZES: Record<Size, string> = {
  sm:   'px-3 py-1.5 text-xs',
  md:   'px-4 py-2.5 text-sm',
  lg:   'px-6 py-3.5 text-base',
  icon: 'p-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading = false, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
