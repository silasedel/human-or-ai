import { forwardRef } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-strong disabled:hover:bg-accent",
  secondary: "border border-border-strong bg-bg text-fg hover:bg-bg-subtle",
  ghost: "text-fg-muted hover:bg-bg-subtle hover:text-fg",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle size={16} className="animate-spin" />}
      {children}
    </button>
  );
});

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-bg px-3.5 text-[15px] text-fg placeholder:text-fg-faint focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-[15px] text-fg placeholder:text-fg-faint focus:border-accent focus:outline-none",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-fg", className)} {...props} />;
}

export function Hint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-xs text-fg-muted", className)} {...props} />;
}

export function ErrorText({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className={cn("rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger", className)}>
      {children}
    </p>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-bg-elevated", className)} {...props} />;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-bg/85 px-4 py-3 backdrop-blur md:px-5">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold">{title}</h1>
        {subtitle && <p className="truncate text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
