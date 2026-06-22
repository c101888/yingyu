import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-display font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-soft hover:brightness-110 hover:shadow-soft-lg',
        accent:
          'bg-accent text-accent-foreground shadow-soft hover:brightness-105 hover:shadow-soft-lg',
        outline:
          'border-2 border-border bg-card/70 text-foreground hover:bg-secondary hover:border-primary/40',
        ghost: 'text-foreground hover:bg-secondary',
        soft: 'bg-sage-soft text-primary hover:bg-sage-soft/70',
        peach: 'bg-peach-soft text-accent-foreground hover:bg-peach-soft/70',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        default: 'h-12 px-6 text-base',
        lg: 'h-14 px-8 text-lg',
        icon: 'h-12 w-12',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
