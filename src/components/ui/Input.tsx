import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const INPUT_BASE = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] text-slate-800 font-sans outline-none transition-all shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-default read-only:bg-slate-50 read-only:text-slate-500 read-only:shadow-none'

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
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-slate-600">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input ref={ref} className={cn(INPUT_BASE, error && 'border-red-400 focus:border-red-400 focus:ring-red-400/10', className)} {...props} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  ),
)
Input.displayName = 'Input'

// ─── Textarea ────────────────────────────────────────────────────────────────

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-slate-600">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={3}
        className={cn(INPUT_BASE, 'resize-y min-h-[72px] leading-relaxed', error && 'border-red-400', className)}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  ),
)
Textarea.displayName = 'Textarea'

// ─── Select ──────────────────────────────────────────────────────────────────

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldProps & { children: React.ReactNode }

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, required, className, children, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-slate-600">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={cn(INPUT_BASE, 'appearance-none pr-8', error && 'border-red-400', className)}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </span>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  ),
)
Select.displayName = 'Select'
