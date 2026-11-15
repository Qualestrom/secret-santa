export type EventPhase = 'REGISTRATION' | 'DRAWING';

export interface PublicParticipant {
  id: string;
  name: string;
  hasDrawn: boolean;
  joinedAt: string;
}

export interface EventState {
  eventName: string;
  budget: string;
  phase: EventPhase;
  participants: PublicParticipant[];
  updatedAt: string;
  storageMode: 'vercel-storage' | 'local-dev';
}

export interface DrawRevealResult {
  participantName: string;
  assignedToName: string;
  state: EventState;
}

export interface SavedParticipantRecord {
  participantId: string;
  name: string;
}
