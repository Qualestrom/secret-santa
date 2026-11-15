import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const REDIS_KEY = 'secret_santa_event_v1';
const REDIS_LOCK_KEY = 'secret_santa_lock_v1';
export const LOCAL_STATE_FILE = path.join(os.tmpdir(), 'secret-santa-dev-state.json');

let localLockTail = Promise.resolve();

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { url: url.replace(/\/+$/, ''), token };
  }
  return null;
}

async function redisCommand(redis, commandArgs) {
  const response = await fetch(redis.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redis.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandArgs),
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vercel Storage command failed (${response.status}): ${text}`);
  }
  return response.json();
}

function withLocalLock(fn) {
  const next = localLockTail.then(() => fn());
  localLockTail = next.catch(() => {});
  return next;
}

async function withRedisLock(redis, fn) {
  if (!redis) return fn();
  const token = crypto.randomUUID();
  const deadline = Date.now() + 3500;
  let acquired = false;

  while (Date.now() < deadline) {
    const res = await redisCommand(redis, ['SET', REDIS_LOCK_KEY, token, 'NX', 'PX', 5000]);
    if (res && res.result === 'OK') {
      acquired = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 35 + crypto.randomInt(0, 35)));
  }

  if (!acquired) {
    const err = new Error('Someone else is pulling a stick right now. Please tap again!');
    err.statusCode = 503;
    throw err;
  }

  try {
    return await fn();
  } finally {
    try {
      await redisCommand(redis, [
        'EVAL',
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        REDIS_LOCK_KEY,
        token,
      ]);
    } catch (unlockErr) {
      console.warn('[api/event] Lock release skipped:', unlockErr);
    }
  }
}

function withStateLock(fn) {
  const redis = getRedisConfig();
  return withLocalLock(() => withRedisLock(redis, fn));
}

function createDefaultState() {
  const envAdminPin = process.env.DEFAULT_ADMIN_PIN;
  return {
    eventName: 'Exchange Gift',
    budget: '$25 Limit',
    phase: 'REGISTRATION',
    roundId: crypto.randomUUID(),
    adminPin: envAdminPin && /^\d{4}$/.test(envAdminPin) ? envAdminPin : '1234',
    participants: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(raw) {
  const base = createDefaultState();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const participants = Array.isArray(raw.participants)
    ? raw.participants.map((p) => ({
        id: typeof p.id === 'string' ? p.id : `p_${crypto.randomUUID()}`,
        name: typeof p.name === 'string' ? p.name : 'Guest',
        hasDrawn: Boolean(p.hasDrawn),
        claimedBy: typeof p.claimedBy === 'string' ? p.claimedBy : null,
        drawnAt: typeof p.drawnAt === 'string' ? p.drawnAt : null,
        joinedAt: typeof p.joinedAt === 'string' ? p.joinedAt : base.updatedAt,
      }))
    : [];

  const rawTitle = typeof raw.eventName === 'string' ? raw.eventName.trim() : '';
  const isLegacyDefault =
    !rawTitle ||
    rawTitle.toLowerCase() === 'christmas secret santa' ||
    rawTitle.toLowerCase() === 'secret santa';

  return {
    eventName: isLegacyDefault ? base.eventName : rawTitle,
    budget: typeof raw.budget === 'string' ? raw.budget : base.budget,
    phase: participants.length > 0 ? 'DRAWING' : 'REGISTRATION',
    roundId: typeof raw.roundId === 'string' && raw.roundId ? raw.roundId : base.roundId,
    adminPin:
      typeof raw.adminPin === 'string' && /^\d{4}$/.test(raw.adminPin)
        ? raw.adminPin
        : base.adminPin,
    participants,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
  };
}

async function getEventState() {
  const redis = getRedisConfig();
  if (redis) {
    const response = await fetch(`${redis.url}/get/${REDIS_KEY}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${redis.token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Vercel Storage read failed (${response.status}): ${text}`);
    }

    const payload = await response.json();
    if (!payload || payload.result === null || payload.result === undefined) {
      return { state: createDefaultState(), storageMode: 'vercel-storage' };
    }

    const parsed = typeof payload.result === 'string' ? JSON.parse(payload.result) : payload.result;
    return { state: normalizeState(parsed), storageMode: 'vercel-storage' };
  }

  try {
    const raw = await fs.readFile(LOCAL_STATE_FILE, 'utf8');
    return { state: normalizeState(JSON.parse(raw)), storageMode: 'local-dev' };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { state: createDefaultState(), storageMode: 'local-dev' };
    }
    throw err;
  }
}

async function saveEventState(state) {
  state.phase = state.participants.length > 0 ? 'DRAWING' : 'REGISTRATION';
  state.updatedAt = new Date().toISOString();
  const redis = getRedisConfig();

  if (redis) {
    const response = await fetch(`${redis.url}/set/${REDIS_KEY}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redis.token}`,
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: JSON.stringify(state),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Vercel Storage write failed (${response.status}): ${text}`);
    }
    return 'vercel-storage';
  }

  await fs.writeFile(LOCAL_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  return 'local-dev';
}

export function sanitizeState(state, storageMode, includeRoster = false) {
  const totalCount = state.participants.length;
  const remainingCount = state.participants.filter((p) => !p.hasDrawn).length;

  const base = {
    eventName: state.eventName,
    budget: state.budget || '',
    phase: totalCount > 0 ? 'DRAWING' : 'REGISTRATION',
    roundId: state.roundId,
    totalCount,
    remainingCount,
    updatedAt: state.updatedAt,
    storageMode,
  };

  if (includeRoster) {
    // Organizer sees participant names only (never who has been picked or by whom)
    base.participants = state.participants.map((p) => ({
      id: p.id,
      name: p.name,
      joinedAt: p.joinedAt,
    }));
  }

  return base;
}

function validateName(rawName, existingParticipants) {
  const cleanName = typeof rawName === 'string' ? rawName.trim().replace(/\s+/g, ' ') : '';
  if (cleanName.length < 2 || cleanName.length > 40) {
    return { error: 'Name must be between 2 and 40 characters.', status: 400 };
  }
  const duplicate = existingParticipants.some(
    (p) => p.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    return {
      error: `"${cleanName}" is already in the pack. Please use a unique name or nickname.`,
      status: 409,
    };
  }
  return { cleanName };
}

function validatePin(rawPin) {
  const cleanPin = typeof rawPin === 'string' ? rawPin.trim() : String(rawPin || '').trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    return { error: 'PIN must be exactly 4 digits (0-9).' };
  }
  return { cleanPin };
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.end(JSON.stringify(payload));
}

function verifyAdmin(body, state) {
  const provided =
    typeof body.adminPin === 'string' ? body.adminPin.trim() : String(body.adminPin || '').trim();
  return provided === state.adminPin;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { state, storageMode } = await getEventState();
      return sendJson(res, 200, { ok: true, state: sanitizeState(state, storageMode, false) });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }

    let body;
    try {
      body = await parseJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON request body.' });
    }

    const action = typeof body.action === 'string' ? body.action.trim() : '';

    // Read-only admin verification doesn't require the write lock
    if (action === 'admin_verify') {
      const { state, storageMode } = await getEventState();
      if (!verifyAdmin(body, state)) {
        return sendJson(res, 403, { error: 'Incorrect Organizer PIN.' });
      }
      return sendJson(res, 200, { ok: true, state: sanitizeState(state, storageMode, true) });
    }

    // All state-changing actions run strictly inside the atomic state lock
    const result = await withStateLock(async () => {
      const { state, storageMode } = await getEventState();

      switch (action) {
        case 'draw': {
          if (state.participants.length === 0) {
            return {
              status: 409,
              payload: {
                error:
                  'The pack is empty — waiting for the organizer to add the participant names.',
              },
            };
          }

          const claimId =
            typeof body.claimId === 'string' && body.claimId.trim().length >= 8
              ? body.claimId.trim()
              : crypto.randomUUID();

          // Idempotency: return same claimed stick if this device retries the same request
          if (body.forceNew !== true) {
            const existing = state.participants.find(
              (p) => p.hasDrawn && p.claimedBy === claimId
            );
            if (existing) {
              return {
                status: 200,
                payload: {
                  ok: true,
                  pickedId: existing.id,
                  assignedToName: existing.name,
                  claimId,
                  state: sanitizeState(state, storageMode, false),
                },
              };
            }
          }

          const available = state.participants.filter((p) => !p.hasDrawn);
          if (available.length === 0) {
            return {
              status: 409,
              payload: { error: 'All sticks in the pack have already been picked!' },
            };
          }

          const chosen = available[crypto.randomInt(0, available.length)];
          chosen.hasDrawn = true;
          chosen.claimedBy = claimId;
          chosen.drawnAt = new Date().toISOString();

          const savedMode = await saveEventState(state);
          return {
            status: 200,
            payload: {
              ok: true,
              pickedId: chosen.id,
              assignedToName: chosen.name,
              claimId,
              state: sanitizeState(state, savedMode, false),
            },
          };
        }

        case 'redraw_self': {
          const claimId = typeof body.claimId === 'string' ? body.claimId.trim() : '';
          const pickedId = typeof body.pickedId === 'string' ? body.pickedId.trim() : '';

          const currentPicked = state.participants.find(
            (p) => p.id === pickedId && p.hasDrawn && (!claimId || p.claimedBy === claimId)
          );
          if (!currentPicked) {
            return {
              status: 409,
              payload: {
                error: 'That stick is no longer active. Please pull a stick from the tin.',
              },
            };
          }

          const otherAvailable = state.participants.filter(
            (p) => !p.hasDrawn && p.id !== currentPicked.id
          );
          if (otherAvailable.length === 0) {
            return {
              status: 409,
              payload: {
                error: 'No other unpicked sticks are left in the tin to swap with.',
              },
            };
          }

          const newClaimId = claimId || crypto.randomUUID();
          const replacement = otherAvailable[crypto.randomInt(0, otherAvailable.length)];

          replacement.hasDrawn = true;
          replacement.claimedBy = newClaimId;
          replacement.drawnAt = new Date().toISOString();

          currentPicked.hasDrawn = false;
          currentPicked.claimedBy = null;
          currentPicked.drawnAt = null;

          const savedMode = await saveEventState(state);
          return {
            status: 200,
            payload: {
              ok: true,
              pickedId: replacement.id,
              assignedToName: replacement.name,
              claimId: newClaimId,
              state: sanitizeState(state, savedMode, false),
            },
          };
        }

        case 'admin_add_participant': {
          if (!verifyAdmin(body, state)) {
            return { status: 403, payload: { error: 'Incorrect Organizer PIN.' } };
          }

          const rawInput = typeof body.name === 'string' ? body.name : '';
          const tokens = rawInput
            .split(/[\r\n,]+/)
            .map((t) => t.trim().replace(/\s+/g, ' '))
            .filter(Boolean);

          if (tokens.length === 0) {
            return {
              status: 400,
              payload: { error: 'Please enter at least one participant name.' },
            };
          }

          const pendingParticipants = [...state.participants];
          const newParticipants = [];

          for (const token of tokens) {
            const nameCheck = validateName(token, pendingParticipants);
            if (nameCheck.error) {
              return { status: nameCheck.status || 400, payload: { error: nameCheck.error } };
            }
            const participant = {
              id: `p_${crypto.randomUUID()}`,
              name: nameCheck.cleanName,
              hasDrawn: false,
              claimedBy: null,
              drawnAt: null,
              joinedAt: new Date().toISOString(),
            };
            pendingParticipants.push(participant);
            newParticipants.push(participant);
          }

          state.participants.push(...newParticipants);
          const savedMode = await saveEventState(state);
          return {
            status: 200,
            payload: {
              ok: true,
              addedCount: newParticipants.length,
              participantId: newParticipants[0].id,
              participantIds: newParticipants.map((p) => p.id),
              state: sanitizeState(state, savedMode, true),
            },
          };
        }

        case 'admin_remove_participant': {
          if (!verifyAdmin(body, state)) {
            return { status: 403, payload: { error: 'Incorrect Organizer PIN.' } };
          }
          const target = state.participants.find((p) => p.id === body.participantId);
          if (!target) {
            return { status: 404, payload: { error: 'Participant not found.' } };
          }
          state.participants = state.participants.filter((p) => p.id !== body.participantId);
          const savedMode = await saveEventState(state);
          return {
            status: 200,
            payload: { ok: true, state: sanitizeState(state, savedMode, true) },
          };
        }

        case 'admin_reshuffle': {
          if (!verifyAdmin(body, state)) {
            return { status: 403, payload: { error: 'Incorrect Organizer PIN.' } };
          }
          if (state.participants.length === 0) {
            return {
              status: 400,
              payload: { error: 'Add participant names before returning sticks to the tin.' },
            };
          }
          state.roundId = crypto.randomUUID();
          state.participants = state.participants.map((p) => ({
            ...p,
            hasDrawn: false,
            claimedBy: null,
            drawnAt: null,
          }));
          const savedMode = await saveEventState(state);
          return {
            status: 200,
            payload: { ok: true, state: sanitizeState(state, savedMode, true) },
          };
        }

        case 'admin_update_settings': {
          if (!verifyAdmin(body, state)) {
            return { status: 403, payload: { error: 'Incorrect Organizer PIN.' } };
          }
          if (typeof body.eventName === 'string') {
            const cleanTitle = body.eventName.trim().replace(/\s+/g, ' ');
            if (cleanTitle.length < 2 || cleanTitle.length > 60) {
              return {
                status: 400,
                payload: { error: 'Event name must be between 2 and 60 characters.' },
              };
            }
            state.eventName = cleanTitle;
          }
          if (typeof body.budget === 'string') {
            const cleanBudget = body.budget.trim().replace(/\s+/g, ' ');
            if (cleanBudget.length > 40) {
              return {
                status: 400,
                payload: { error: 'Budget / note must be 40 characters or less.' },
              };
            }
            state.budget = cleanBudget;
          }
          if (body.newAdminPin !== undefined && String(body.newAdminPin).trim() !== '') {
            const pinCheck = validatePin(body.newAdminPin);
            if (pinCheck.error) {
              return { status: 400, payload: { error: `New Organizer ${pinCheck.error}` } };
            }
            state.adminPin = pinCheck.cleanPin;
          }
          const savedMode = await saveEventState(state);
          return {
            status: 200,
            payload: {
              ok: true,
              adminPinUpdated: Boolean(body.newAdminPin && String(body.newAdminPin).trim() !== ''),
              state: sanitizeState(state, savedMode, true),
            },
          };
        }

        case 'admin_reset_all': {
          if (!verifyAdmin(body, state)) {
            return { status: 403, payload: { error: 'Incorrect Organizer PIN.' } };
          }
          state.roundId = crypto.randomUUID();
          state.participants = [];
          state.phase = 'REGISTRATION';
          const savedMode = await saveEventState(state);
          return {
            status: 200,
            payload: { ok: true, state: sanitizeState(state, savedMode, true) },
          };
        }

        default:
          return { status: 400, payload: { error: 'Unknown action.' } };
      }
    });

    return sendJson(res, result.status, result.payload);
  } catch (err) {
    console.error('[api/event] Error:', err);
    const status = err && typeof err.statusCode === 'number' ? err.statusCode : 500;
    return sendJson(res, status, {
      error: status === 503 ? err.message : 'Server error. Please try again.',
    });
  }
}
