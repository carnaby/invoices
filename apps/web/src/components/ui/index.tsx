import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/** Every UI-kit primitive can carry a `data-testid` for e2e hooks, even though
 * @types/react has no index signature for `data-*` on custom components. */
type WithTestId = { 'data-testid'?: string };

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const fieldClasses =
  'w-full rounded-xl border border-[#e8e8ed] bg-white px-4 py-2.5 text-sm text-[#1d1d1f] outline-none transition placeholder:text-[#8e8e93] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 disabled:cursor-not-allowed disabled:opacity-50';

export function Card({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & WithTestId) {
  return (
    <div
      className={cn('rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = 'default',
  ...rest
}: { label: string; value: string; tone?: 'default' | 'success' | 'danger' } & WithTestId) {
  const valueColor =
    tone === 'success' ? 'text-[#34c759]' : tone === 'danger' ? 'text-[#ff3b30]' : 'text-[#1d1d1f]';
  return (
    <Card {...rest}>
      <p className="text-sm font-medium text-[#6e6e73]">{label}</p>
      <p className={cn('mt-2 text-[28px] font-semibold tracking-tight', valueColor)}>{value}</p>
    </Card>
  );
}

const badgeTones = {
  green: 'bg-[#34c759]/10 text-[#34c759]',
  orange: 'bg-[#ff9500]/10 text-[#ff9500]',
  gray: 'bg-[#8e8e93]/10 text-[#8e8e93]',
  red: 'bg-[#ff3b30]/10 text-[#ff3b30]',
} as const;

export function Badge({
  tone,
  children,
  className,
  ...rest
}: { tone: keyof typeof badgeTones; children: ReactNode; className?: string } & WithTestId) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', badgeTones[tone], className)}
      {...rest}
    >
      {children}
    </span>
  );
}

const buttonVariants = {
  primary: 'bg-[#0071e3] text-white hover:bg-[#0077ed]',
  secondary: 'border border-[#e8e8ed] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]',
  danger: 'bg-[#ff3b30] text-white hover:bg-[#e0342b]',
  ghost: 'bg-transparent text-[#1d1d1f] hover:bg-[#f5f5f7]',
} as const;

export function Button({
  variant = 'primary',
  className,
  ...rest
}: { variant?: keyof typeof buttonVariants } & ButtonHTMLAttributes<HTMLButtonElement> & WithTestId) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        className,
      )}
      {...rest}
    />
  );
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
    <label htmlFor={id} className="block text-sm font-medium text-[#1d1d1f]">
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
    <label htmlFor={id} className="block text-sm font-medium text-[#1d1d1f]">
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
    <label htmlFor={id} className="block text-sm font-medium text-[#1d1d1f]">
      <span className="mb-1.5 block">{label}</span>
      {textarea}
    </label>
  );
}

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <label className="block text-sm font-medium text-[#1d1d1f]">
      <span className="mb-1.5 block">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs font-normal text-[#ff3b30]">{error}</span>}
    </label>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex items-center justify-between gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {action}
    </div>
  );
}

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-left text-sm', className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-[#e8e8ed] text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[#e8e8ed]">{children}</tbody>;
}

export function Tr({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & WithTestId) {
  return (
    <tr className={cn('transition hover:bg-[#f5f5f7]/60', className)} {...rest}>
      {children}
    </tr>
  );
}

export function Th({ className, children }: { className?: string; children: ReactNode }) {
  return <th className={cn('py-3 pr-4 font-medium', className)}>{children}</th>;
}

export function Td({ className, children }: { className?: string; children: ReactNode }) {
  return <td className={cn('py-3.5 pr-4 text-[#1d1d1f]', className)}>{children}</td>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Potvrdiť',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-2 text-sm text-[#6e6e73]">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" data-testid="cancel" onClick={onCancel}>
            Zrušiť
          </Button>
          <Button variant="danger" data-testid="confirm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
