import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui's class combiner: clsx for conditionals, tailwind-merge to resolve conflicts. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
