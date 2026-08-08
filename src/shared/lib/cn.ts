import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge conditional class names, letting the *last* Tailwind utility win.
 * Without twMerge, `cn('px-4', props.className)` silently loses to specificity
 * order and callers can't override a primitive's padding.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
