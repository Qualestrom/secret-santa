export type EventPhase = 'REGISTRATION' | 'DRAWING';

export interface PublicParticipant {
  id: string;
  name: string;
  hasDrawn?: boolean;
  drawnAt?: string | null;
  joinedAt: string;
}

export interface EventState {
  eventName: string;
  budget: string;
  phase: EventPhase;
  roundId: string;
  totalCount: number;
  remainingCount: number;
  participants?: PublicParticipant[];
  updatedAt: string;
  storageMode: 'vercel-storage' | 'local-dev';
}

export interface DrawRevealResult {
  pickedId: string;
  assignedToName: string;
  claimId: string;
  state: EventState;
}

export interface SavedDrawRecord {
  roundId: string;
  claimId: string;
  pickedId: string;
  recipientName: string;
  stickNumber: number;
}
