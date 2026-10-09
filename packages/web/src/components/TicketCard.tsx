import { Link } from 'react-router-dom';
import { MS_PER_DAY, type Ticket, type User } from '@dp/shared';
import { Avatar, PriorityTag } from './ui';

interface Props {
  ticket: Ticket;
  assignee: User | null;
  draggable?: boolean;
  onDragStart?: (ticket: Ticket) => void;
  onDragOver?: (ticket: Ticket) => void;
  selected?: boolean;
  onToggleSelect?: (ticket: Ticket) => void;
}

function dueClass(dueAt: number | null): string {
  if (dueAt === null) return '';
  const now = Date.now();
  if (dueAt < now) return 'due-overdue';
  if (dueAt - now < 3 * MS_PER_DAY) return 'due-soon';
  return '';
}

export function TicketCard({
  ticket,
  assignee,
  draggable,
  onDragStart,
  onDragOver,
  selected,
  onToggleSelect,
}: Props) {
  return (
    <article
      className={`ticket-card ${selected ? 'selected' : ''}`}
      draggable={draggable}
      onDragStart={() => onDragStart?.(ticket)}
      onDragOver={(event) => {
        if (!onDragOver) return;
        event.preventDefault();
        onDragOver(ticket);
      }}
    >
      <header>
        {onToggleSelect ? (
          <input
            type="checkbox"
            checked={Boolean(selected)}
            onChange={() => onToggleSelect(ticket)}
            aria-label={`select ${ticket.key}`}
          />
        ) : null}
        <Link to={`/tickets/${ticket.id}`} className="ticket-key">
          {ticket.key}
        </Link>
        <PriorityTag priority={ticket.priority} />
      </header>
      <Link to={`/tickets/${ticket.id}`} className="ticket-title">
        {ticket.title}
      </Link>
      <footer>
        <div className="labels">
          {ticket.labels.map((label) => (
            <span key={label} className="label-chip">
              {label}
            </span>
          ))}
        </div>
        <div className="card-meta">
          {ticket.due_at ? (
            <span className={`due ${dueClass(ticket.due_at)}`}>
              {new Date(ticket.due_at).toLocaleDateString()}
            </span>
          ) : null}
          {ticket.estimate ? <span className="estimate">{ticket.estimate}pt</span> : null}
          <Avatar user={assignee} size={22} />
        </div>
      </footer>
    </article>
  );
}
