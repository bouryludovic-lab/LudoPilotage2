import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const INPUT_BASE = 'w-full rounded-xl px-4 py-3 text-sm font-medium outline-none transition-all duration-150 placeholder:text-white/25 disabled:opacity-40 disabled:cursor-default'
const INPUT_STYLE = 'bg-white/5 border border-white/8 text-white/85 focus:border-violet-500/60 focus:bg-violet-500/5 focus:ring-2 focus:ring-violet-500/10'

interface FieldProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
}

// ─── Input ───────────────────────────────────────────────────────────────────

type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldProps

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-white/50 tracking-wide uppercase">
          {label}{required && <span className="text-violet-400 ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={ref}
        className={cn(INPUT_BASE, INPUT_STYLE, error && 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/10', className)}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-white/30">{hint}</p>}
    </div>
  ),
)
Input.displayName = 'Input'

// ─── Textarea ────────────────────────────────────────────────────────────────

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-white/50 tracking-wide uppercase">
          {label}{required && <span className="text-violet-400 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={3}
        className={cn(INPUT_BASE, INPUT_STYLE, 'resize-y min-h-[80px] leading-relaxed', error && 'border-red-500/40', className)}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-white/30">{hint}</p>}
    </div>
  ),
)
Textarea.displayName = 'Textarea'

// ─── Select ──────────────────────────────────────────────────────────────────

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldProps & { children: React.ReactNode }

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, required, className, children, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-white/50 tracking-wide uppercase">
          {label}{required && <span className="text-violet-400 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={cn(INPUT_BASE, INPUT_STYLE, 'appearance-none pr-9 cursor-pointer', error && 'border-red-500/40', className)}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </span>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-white/30">{hint}</p>}
    </div>
  ),
)
Select.displayName = 'Select'
