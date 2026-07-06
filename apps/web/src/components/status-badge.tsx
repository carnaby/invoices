import { Badge } from './ui';

export function StatusBadge({
  status,
  overdue,
}: {
  status: 'paid' | 'partial' | 'unpaid';
  overdue: boolean;
}) {
  if (overdue) return <Badge tone="red">Po splatnosti</Badge>;
  if (status === 'paid') return <Badge tone="green">Uhradená</Badge>;
  if (status === 'partial') return <Badge tone="orange">Čiastočne uhradená</Badge>;
  return <Badge tone="gray">Neuhradená</Badge>;
}
