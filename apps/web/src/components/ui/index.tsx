// Imported only from client components (it uses hooks); no 'use client' here because
// Next does not allow `export *` across a client boundary.
import {
  useEffect,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export * from './icons';

/** Every UI-kit primitive can carry a `data-testid` for e2e hooks, even though
 * @types/react has no index signature for `data-*` on custom components. */
type WithTestId = { 'data-testid'?: string };

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

// 16px text on phones: iOS zooms into any focused field with a smaller font.
const fieldClasses =
  'w-full min-w-0 rounded-xl border border-line bg-surface px-4 py-2.5 text-base text-ink outline-none transition placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';

export function Card({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & WithTestId) {
  return (
    <div className={cn('rounded-2xl bg-surface p-4 shadow-card sm:p-6', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('mb-4 text-lg font-semibold tracking-tight sm:mb-6', className)}>{children}</h2>;
}

export function StatTile({
  label,
  value,
  tone = 'default',
  className,
  ...rest
}: {
  label: string;
  /** Several values (one per currency) go on separate lines. */
  value: string | string[];
  tone?: 'default' | 'success' | 'danger';
  className?: string;
} & WithTestId) {
  const lines = Array.isArray(value) ? value : [value];
  const valueColor = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <Card className={cn('min-w-0 overflow-hidden', className)} {...rest}>
      <p className="truncate text-xs font-medium text-muted sm:text-sm">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tracking-tight tabular-nums sm:mt-2 sm:text-[28px] sm:leading-tight',
          valueColor,
        )}
      >
        {lines.map((line, i) => (
          <span key={i} className="block whitespace-nowrap">
            {line}
          </span>
        ))}
      </p>
    </Card>
  );
}

const badgeTones = {
  green: 'bg-success/10 text-success',
  orange: 'bg-warning/10 text-warning',
  gray: 'bg-subtle/10 text-subtle',
  red: 'bg-danger/10 text-danger',
  blue: 'bg-accent/10 text-accent',
  neutral: 'bg-lock/15 text-ink',
} as const;

export function Badge({
  tone,
  children,
  className,
  title,
  ...rest
}: { tone: keyof typeof badgeTones; children: ReactNode; className?: string; title?: string } & WithTestId) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        badgeTones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

const buttonVariants = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
  danger: 'bg-danger text-white hover:bg-danger-hover',
  ghost: 'bg-transparent text-ink hover:bg-canvas',
} as const;
export type ButtonVariant = keyof typeof buttonVariants;

/** Button look for links (`<a>`, `<Link>`) that act as buttons. */
export function buttonClasses(variant: ButtonVariant = 'primary', className?: string) {
  return cn(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition select-none disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10',
    buttonVariants[variant],
    className,
  );
}

export function Button({
  variant = 'primary',
  className,
  ...rest
}: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement> & WithTestId) {
  return <button className={buttonClasses(variant, className)} {...rest} />;
}

export function Input({
  label,
  className,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string } & WithTestId) {
  const input = <input id={id} className={cn(fieldClasses, className)} {...rest} />;
  if (!label) return input;
  return (
    <label htmlFor={id} className="block text-sm font-medium text-ink">
      <span className="mb-1.5 block">{label}</span>
      {input}
    </label>
  );
}

export function Select({
  label,
  className,
  id,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string } & WithTestId) {
  const select = (
    <select id={id} className={cn(fieldClasses, className)} {...rest}>
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <label htmlFor={id} className="block text-sm font-medium text-ink">
      <span className="mb-1.5 block">{label}</span>
      {select}
    </label>
  );
}

export function Textarea({
  label,
  className,
  id,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string } & WithTestId) {
  const textarea = <textarea id={id} className={cn(fieldClasses, 'min-h-24 resize-y', className)} {...rest} />;
  if (!label) return textarea;
  return (
    <label htmlFor={id} className="block text-sm font-medium text-ink">
      <span className="mb-1.5 block">{label}</span>
      {textarea}
    </label>
  );
}

export function Field({
  label,
  children,
  error,
  className,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <label className={cn('block min-w-0 text-sm font-medium text-ink', className)}>
      <span className="mb-1.5 block">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs font-normal text-danger">{error}</span>}
    </label>
  );
}

export function PageHeader({
  title,
  action,
  meta,
}: {
  title: string;
  action?: ReactNode;
  /** Small line under the title (badges, status). */
  meta?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 sm:mb-8">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted">{children}</p>;
}

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className={cn('w-full text-left text-sm', className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line text-xs font-medium uppercase tracking-wide text-muted">{children}</thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function Tr({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement> & WithTestId) {
  return (
    <tr className={cn('transition hover:bg-canvas/60', className)} {...rest}>
      {children}
    </tr>
  );
}

export function Th({ className, children, ...rest }: { className?: string; children: ReactNode } & WithTestId) {
  return (
    <th className={cn('py-3 pr-4 font-medium', className)} {...rest}>
      {children}
    </th>
  );
}

export function Td({ className, children, ...rest }: { className?: string; children: ReactNode } & WithTestId) {
  return (
    <td className={cn('py-3.5 pr-4 text-ink', className)} {...rest}>
      {children}
    </td>
  );
}

/**
 * Modal surface: a bottom sheet on phones, a centered card from `sm` up.
 * Escape calls `onClose`; a click on the backdrop does not, so a stray tap
 * cannot throw away a half-filled form.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  size = 'sm',
  ...rest
}: {
  title: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'lg';
} & WithTestId) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface shadow-card sm:rounded-2xl',
          size === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-sm',
        )}
        {...rest}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="overflow-y-auto px-5 pt-4 pb-2 sm:px-6 sm:pt-6">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {children}
        </div>
        {footer && (
          <div className="pb-safe border-t border-line sm:border-0">
            <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:pt-2 sm:pb-6 [&>*]:w-full sm:[&>*]:w-auto">
              {footer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Potvrdiť',
  onConfirm,
  onCancel,
  error,
  pending = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  error?: string;
  /** Disables Confirm while the action runs, so a double click does not send it twice. */
  pending?: boolean;
}) {
  if (!open) return null;
  return (
    <Sheet
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" data-testid="cancel" onClick={onCancel}>
            Zrušiť
          </Button>
          <Button variant="danger" data-testid="confirm" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      {error && (
        <p data-testid="confirm-error" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}
    </Sheet>
  );
}
