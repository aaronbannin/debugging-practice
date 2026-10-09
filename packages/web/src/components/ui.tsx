import type { ReactNode } from 'react';
import { PRIORITY_LABELS, STATUS_LABELS, type Priority, type Status } from '@dp/shared';
import type { User } from '@dp/shared';

export function StatusPill({ status }: { status: Status }) {
  return <span className={`pill status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityTag({ priority }: { priority: Priority }) {
  return <span className={`pill priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>;
}

export function Avatar({ user, size = 26 }: { user: User | null; size?: number }) {
  if (!user) {
    return (
      <span className="avatar avatar-empty" style={{ width: size, height: size, fontSize: size / 2.4 }}>
        ?
      </span>
    );
  }
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');
  return (
    <span
      className="avatar"
      title={user.name}
      style={{ width: size, height: size, background: user.avatar_color, fontSize: size / 2.4 }}
    >
      {initials}
    </span>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div className="spinner">{label}…</div>;
}

export function ErrorNote({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  const requestId = (error as { requestId?: string })?.requestId;
  return (
    <div className="error-note">
      <strong>Request failed:</strong> {message}
      {requestId ? <span className="muted"> (request {requestId.slice(0, 8)})</span> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}
