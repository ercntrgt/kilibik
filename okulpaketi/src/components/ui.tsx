import Link from 'next/link';
import { MESSAGE_STATUS_LABELS, CAMPAIGN_STATUS_LABELS, RECIPIENT_STATUS_LABELS, formatNumber } from '@/lib/format';

export function Card({
  title, description, actions, children, className = '',
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-ink-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-ink-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({
  label, value, tone = 'default', hint,
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  hint?: string;
}) {
  const tones: Record<string, string> = {
    default: 'text-ink-900',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    info: 'text-brand-600',
  };
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  pending: 'bg-ink-100 text-ink-700 border-ink-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  sent: 'bg-brand-50 text-brand-700 border-brand-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  read: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  failed: 'bg-red-50 text-red-700 border-red-200',
  valid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  invalid: 'bg-red-50 text-red-700 border-red-200',
  duplicate: 'bg-amber-50 text-amber-700 border-amber-200',
  duplicate_previous: 'bg-amber-50 text-amber-700 border-amber-200',
  draft: 'bg-ink-100 text-ink-700 border-ink-200',
  ready: 'bg-blue-50 text-blue-700 border-blue-200',
  sending: 'bg-brand-50 text-brand-700 border-brand-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-ink-100 text-ink-500 border-ink-200',
};

export function StatusBadge({ status, kind = 'message' }: { status: string; kind?: 'message' | 'campaign' | 'recipient' }) {
  const labels =
    kind === 'campaign' ? CAMPAIGN_STATUS_LABELS : kind === 'recipient' ? RECIPIENT_STATUS_LABELS : MESSAGE_STATUS_LABELS;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_TONES[status] ?? 'bg-ink-100 text-ink-700 border-ink-200'}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  const isTest = mode === 'test';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        isTest ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-red-300 bg-red-50 text-red-700'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isTest ? 'bg-amber-500' : 'bg-red-500'}`} />
      {isTest ? 'TEST MODU' : 'CANLI GÖNDERİM'}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-200 bg-ink-50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LinkButton({
  href, children, variant = 'secondary',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const styles =
    variant === 'primary'
      ? 'bg-brand-600 text-white hover:bg-brand-700'
      : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50';
  return (
    <Link href={href} className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${styles}`}>
      {children}
    </Link>
  );
}

export function ProgressBar({ value, total }: { value: number; total: number }) {
  const ratio = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${ratio}%` }} />
    </div>
  );
}

export function TableShell({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
          {head}
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
    </div>
  );
}
