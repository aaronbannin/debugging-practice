import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PRIORITIES, PRIORITY_LABELS, type Priority } from '@dp/shared';
import { api } from '../api/client';
import { useAppState } from '../hooks/useAppState';
import { ErrorNote, Field } from './ui';

export function NewTicketDialog({ onClose }: { onClose: () => void }) {
  const { projectId, actorId, users } = useAppState();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('p2');
  const [assignee, setAssignee] = useState('');
  const [labels, setLabels] = useState('');
  const [estimate, setEstimate] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState<unknown>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createTicket({
        project_id: projectId,
        title,
        description: description || null,
        priority,
        assignee_id: assignee || null,
        reporter_id: actorId,
        estimate: estimate === '' ? null : Number(estimate),
        due_at: due === '' ? null : Date.parse(`${due}T12:00:00.000Z`),
        labels: labels
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
      }),
    onError: setError,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['board'] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h3>New ticket</h3>
        {error ? <ErrorNote error={error} /> : null}
        <Field label="Title">
          <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </Field>
        <Field label="Description">
          <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <div className="detail-grid">
          <Field label="Priority">
            <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assignee">
            <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estimate">
            <input type="number" min={0} value={estimate} onChange={(event) => setEstimate(event.target.value)} />
          </Field>
          <Field label="Due date">
            <input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
          </Field>
        </div>
        <Field label="Labels (comma separated)">
          <input value={labels} onChange={(event) => setLabels(event.target.value)} />
        </Field>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={title.trim().length < 3 || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
