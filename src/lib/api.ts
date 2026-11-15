import type { DrawRevealResult, EventState } from '../types';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchEventState(): Promise<EventState> {
  const res = await fetch('/api/event', { method: 'GET', cache: 'no-store' });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new ApiError(data.error || 'Failed to load event state.', res.status);
  }
  return data.state as EventState;
}

export async function postEventAction<T extends Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T & { ok: boolean; state: EventState }> {
  const res = await fetch('/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new ApiError(data.error || 'Request failed.', res.status);
  }
  return data as T & { ok: boolean; state: EventState };
}

export async function revealDrawMatch(
  participantId: string,
  pin: string
): Promise<DrawRevealResult> {
  const data = await postEventAction<{
    participantName: string;
    assignedToName: string;
  }>('draw', { participantId, pin });

  return {
    participantName: data.participantName,
    assignedToName: data.assignedToName,
    state: data.state,
  };
}
