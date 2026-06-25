import { cn } from '@/lib/cn';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'allow' | 'subtle';
type Size = 'sm' | 'md' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'border border-border bg-card text-foreground hover:bg-accent',
  ghost: 'text-foreground hover:bg-accent',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
  allow: 'bg-allow text-allow-foreground hover:opacity-90',
  subtle: 'text-muted-foreground hover:text-foreground hover:bg-accent',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-[13px]',
  md: 'h-9 gap-2 px-3.5 text-sm',
  icon: 'h-9 w-9',
};

const BASE =
  'inline-flex cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

// Shared so a <Link> can be styled identically to a <Button> without a Slot clone.
export function buttonClass(opts: { variant?: Variant; size?: Size; className?: string } = {}): string {
  const { variant = 'secondary', size = 'md', className } = opts;
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant, size, className, type, ...props }: ButtonProps) {
  // real <button>; default type=button so it never submits a form by accident
  return <button type={type ?? 'button'} className={buttonClass({ variant, size, className })} {...props} />;
}
