import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';
import { LS_AUTH_TOKEN } from './constants';

const originalFetch = global.fetch;

describe('api.ts', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('includes auth token if present in localStorage', async () => {
    localStorage.setItem(LS_AUTH_TOKEN, 'test-jwt');
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ active: false })),
    });

    await api.timer.getActiveTimer();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/timer/active'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt',
        }),
      })
    );
  });

  it('calls correct endpoint for deleteSubjectCompletely', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ success: true })),
    });

    await api.timer.deleteSubjectCompletely('Math');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/timer/subjects/completely'),
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ name: 'Math' }),
      })
    );
  });
  
  it('throws an error if the response is not ok', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: () => Promise.resolve(JSON.stringify({ error: 'Subject name required' })),
    });

    await expect(api.timer.addSubject('')).rejects.toThrow('Subject name required');
  });
});
