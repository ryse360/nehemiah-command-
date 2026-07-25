import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// The standard shadcn/ui class merge helper: clsx for conditional classes,
// tailwind-merge to resolve conflicting Tailwind utilities deterministically.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
