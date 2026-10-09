import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  PAGE_SIZE_MAX,
  STATUSES,
  createTicketSchema,
  listQuerySchema,
  statsQuerySchema,
  transitionSchema,
} from '@dp/shared';

describe('createTicketSchema', () => {
  it('fills in defaults', () => {
    const parsed = createTicketSchema.parse({
      project_id: 'prj_0001',
      title: 'Something broke',
      reporter_id: 'usr_0001',
    });
    expect(parsed.priority).toBe('p2');
    expect(parsed.labels).toEqual([]);
  });

  it('rejects short titles', () => {
    expect(() =>
      createTicketSchema.parse({ project_id: 'p', title: 'no', reporter_id: 'u' }),
    ).toThrow();
  });

  it('rejects malformed labels', () => {
    expect(() =>
      createTicketSchema.parse({
        project_id: 'p',
        title: 'valid title',
        reporter_id: 'u',
        labels: ['not a label'],
      }),
    ).toThrow();
  });
});

describe('listQuerySchema', () => {
  it('applies sensible defaults', () => {
    const parsed = listQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.page_size).toBe(25);
    expect(parsed.sort).toBe('updated_at');
    expect(parsed.dir).toBe('desc');
  });

  it('splits comma separated filters', () => {
    const parsed = listQuerySchema.parse({ status: 'todo,done', priority: 'p0' });
    expect(parsed.status).toEqual(['todo', 'done']);
    expect(parsed.priority).toEqual(['p0']);
  });

  it('clamps the page size', () => {
    expect(listQuerySchema.parse({ page_size: '5000' }).page_size).toBe(PAGE_SIZE_MAX);
    expect(listQuerySchema.parse({ page_size: '-4' }).page_size).toBe(25);
  });

  it('coerces boolean flags', () => {
    expect(listQuerySchema.parse({ overdue: 'true' }).overdue).toBe(true);
    expect(listQuerySchema.parse({ overdue: 'false' }).overdue).toBe(false);
  });
});

describe('statsQuerySchema', () => {
  it('defaults and clamps the window', () => {
    expect(statsQuerySchema.parse({}).days).toBe(7);
    expect(statsQuerySchema.parse({ days: '500' }).days).toBe(90);
  });
});

describe('transitionSchema', () => {
  it('requires a known target status', () => {
    expect(transitionSchema.parse({ to: 'done', actor_id: 'u' }).to).toBe('done');
    expect(() => transitionSchema.parse({ to: 'nope', actor_id: 'u' })).toThrow();
  });
});

describe('status machine', () => {
  it('declares transitions for every status', () => {
    for (const status of STATUSES) {
      expect(Array.isArray(ALLOWED_TRANSITIONS[status])).toBe(true);
    }
  });

  it('only targets known statuses', () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const target of targets) {
        expect(STATUSES).toContain(target);
      }
    }
  });

  it('never lists a status as its own transition target', () => {
    for (const status of STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).not.toContain(status);
    }
  });
});
