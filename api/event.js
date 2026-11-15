const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const REDIS_KEY = "secret_santa_event_v1";
const LOCAL_STATE_FILE = path.join(os.tmpdir(), "secret-santa-dev-state.json");

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { url: url.replace(/\/+$/, ""), token };
  }
  return null;
}

function createDefaultState() {
  const envAdminPin = process.env.DEFAULT_ADMIN_PIN;
  return {
    eventName: "Secret Santa Gift Exchange",
    budget: "$25 Limit",
    phase: "REGISTRATION",
    adminPin: envAdminPin && /^\d{4}$/.test(envAdminPin) ? envAdminPin : "1234",
    participants: [],
    updatedAt: new Date().toISOString()
  };
}

function normalizeState(raw) {
  const base = createDefaultState();
  if (!raw || typeof raw !== "object") {
    return base;
  }
  return {
    eventName: typeof raw.eventName === "string" && raw.eventName.trim() ? raw.eventName.trim() : base.eventName,
    budget: typeof raw.budget === "string" ? raw.budget : base.budget,
    phase: raw.phase === "DRAWING" ? "DRAWING" : "REGISTRATION",
    adminPin: typeof raw.adminPin === "string" && /^\d{4}$/.test(raw.adminPin) ? raw.adminPin : base.adminPin,
    participants: Array.isArray(raw.participants) ? raw.participants : [],
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt
  };
}

async function getEventState() {
  const redis = getRedisConfig();
  if (redis) {
    const response = await fetch(`${redis.url}/get/${REDIS_KEY}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${redis.token}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Vercel Storage read failed (${response.status}): ${text}`);
    }

    const payload = await response.json();
    if (!payload || payload.result === null || payload.result === undefined) {
      return { state: createDefaultState(), storageMode: "vercel-storage" };
    }

    const parsed = typeof payload.result === "string" ? JSON.parse(payload.result) : payload.result;
    return { state: normalizeState(parsed), storageMode: "vercel-storage" };
  }

  try {
    const raw = await fs.readFile(LOCAL_STATE_FILE, "utf8");
    return { state: normalizeState(JSON.parse(raw)), storageMode: "local-dev" };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return { state: createDefaultState(), storageMode: "local-dev" };
    }
    throw err;
  }
}

async function saveEventState(state) {
  state.updatedAt = new Date().toISOString();
  const redis = getRedisConfig();

  if (redis) {
    const response = await fetch(`${redis.url}/set/${REDIS_KEY}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redis.token}`,
        "Content-Type": "text/plain; charset=utf-8"
      },
      body: JSON.stringify(state)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Vercel Storage write failed (${response.status}): ${text}`);
    }
    return "vercel-storage";
  }

  await fs.writeFile(LOCAL_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  return "local-dev";
}

function sanitizeState(state, storageMode) {
  return {
    eventName: state.eventName,
    budget: state.budget || "",
    phase: state.phase,
    participants: state.participants.map((p) => ({
      id: p.id,
      name: p.name,
      hasDrawn: Boolean(p.hasDrawn),
      joinedAt: p.joinedAt
    })),
    updatedAt: state.updatedAt,
    storageMode
  };
}

function generateSingleCycleDerangement(participants) {
  if (!Array.isArray(participants) || participants.length < 3) {
    throw new Error("At least 3 participants are required to draw names.");
  }

  const shuffled = participants.map((p) => ({ ...p }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }

  const byId = new Map();
  for (let i = 0; i < shuffled.length; i++) {
    const giver = shuffled[i];
    const receiver = shuffled[(i + 1) % shuffled.length];
    giver.assignedToId = receiver.id;
    giver.hasDrawn = false;
    byId.set(giver.id, giver);
  }

  return participants.map((p) => byId.get(p.id));
}

function validateName(rawName, existingParticipants) {
  const cleanName = typeof rawName === "string" ? rawName.trim().replace(/\s+/g, " ") : "";
  if (cleanName.length < 2 || cleanName.length > 40) {
    return { error: "Name must be between 2 and 40 characters.", status: 400 };
  }
  const duplicate = existingParticipants.some(
    (p) => p.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    return {
      error: `"${cleanName}" has already joined. Please add a last initial or nickname.`,
      status: 409
    };
  }
  return { cleanName };
}

function validatePin(rawPin) {
  const cleanPin = typeof rawPin === "string" ? rawPin.trim() : String(rawPin || "").trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    return { error: "PIN must be exactly 4 digits (0-9)." };
  }
  return { cleanPin };
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string") {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.end(JSON.stringify(payload));
}

function verifyAdmin(body, state) {
  const provided = typeof body.adminPin === "string" ? body.adminPin.trim() : String(body.adminPin || "").trim();
  return provided === state.adminPin;
}

async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { state, storageMode } = await getEventState();
      return sendJson(res, 200, { ok: true, state: sanitizeState(state, storageMode) });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    let body;
    try {
      body = await parseJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: "Invalid JSON request body." });
    }

    const action = typeof body.action === "string" ? body.action.trim() : "";
    const { state, storageMode } = await getEventState();

    switch (action) {
      case "register": {
        if (state.phase !== "REGISTRATION") {
          return sendJson(res, 409, { error: "Registration is locked because the draw has already started." });
        }
        const nameCheck = validateName(body.name, state.participants);
        if (nameCheck.error) return sendJson(res, nameCheck.status || 400, { error: nameCheck.error });

        const pinCheck = validatePin(body.pin);
        if (pinCheck.error) return sendJson(res, 400, { error: pinCheck.error });

        const participant = {
          id: `p_${crypto.randomUUID()}`,
          name: nameCheck.cleanName,
          pin: pinCheck.cleanPin,
          assignedToId: null,
          hasDrawn: false,
          joinedAt: new Date().toISOString()
        };
        state.participants.push(participant);
        const savedMode = await saveEventState(state);

        return sendJson(res, 200, {
          ok: true,
          participantId: participant.id,
          state: sanitizeState(state, savedMode || storageMode)
        });
      }

      case "draw": {
        if (state.phase !== "DRAWING") {
          return sendJson(res, 409, { error: "Drawing has not started yet. Ask the organizer to open the draw." });
        }
        const participant = state.participants.find((p) => p.id === body.participantId);
        if (!participant) {
          return sendJson(res, 404, { error: "Participant not found." });
        }

        const pinCheck = validatePin(body.pin);
        if (pinCheck.error) return sendJson(res, 400, { error: pinCheck.error });

        if (participant.pin !== pinCheck.cleanPin) {
          return sendJson(res, 403, {
            error: "Incorrect 4-digit PIN. Please try again or ask the organizer to reset your PIN."
          });
        }

        const recipient = state.participants.find((p) => p.id === participant.assignedToId);
        if (!recipient) {
          return sendJson(res, 500, {
            error: "Match assignment is missing. Please ask the organizer to re-shuffle."
          });
        }

        let currentMode = storageMode;
        if (!participant.hasDrawn) {
          participant.hasDrawn = true;
          currentMode = await saveEventState(state);
        }

        return sendJson(res, 200, {
          ok: true,
          participantName: participant.name,
          assignedToName: recipient.name,
          state: sanitizeState(state, currentMode)
        });
      }

      case "admin_verify": {
        if (!verifyAdmin(body, state)) {
          return sendJson(res, 403, { error: "Incorrect Organizer PIN." });
        }
        return sendJson(res, 200, { ok: true, state: sanitizeState(state, storageMode) });
      }

      case "admin_start_draw": {
        if (!verifyAdmin(body, state)) {
          return sendJson(res, 403, { error: "Incorrect Organizer PIN." });
        }
        if (state.phase === "DRAWING") {
          return sendJson(res, 409, { error: "Draw is already open. Use Re-shuffle if you want new pairings." });
        }
        if (state.participants.length < 3) {
          return sendJson(res, 400, {
            error: "At least 3 participants are required so nobody gets paired in a predictable 2-person loop."
          });
        }
        state.participants = generateSingleCycleDerangement(state.participants);
        state.phase = "DRAWING";
        const savedMode = await saveEventState(state);
        return sendJson(res, 200, { ok: true, state: sanitizeState(state, savedMode) });
      }

      case "admin_remove_participant": {
        if (!verifyAdmin(body, state)) {
          return sendJson(res, 403, { error: "Incorrect Organizer PIN." });
        }
        if (state.phase !== "REGISTRATION") {
          return sendJson(res, 409, { error: "Re-open registration before removing participants." });
        }
        const beforeCount = state.participants.length;
        state.participants = state.participants.filter((p) => p.id !== body.participantId);
        if (state.participants.length === beforeCount) {
          return sendJson(res, 404, { error: "Participant not found." });
        }
        const savedMode = await saveEventState(state);
        return sendJson(res, 200, { ok: true, state: sanitizeState(state, savedMode) });
      }

      case "admin_add_participant": {
        if (!verifyAdmin(body, state)) {
          return sendJson(res, 403, { error: "Incorrect Organizer PIN." });
        }
        if (state.phase !== "REGISTRATION") {
          return sendJson(res, 409, { error: "Re-open registration before adding participants." });
        }
        const nameCheck = validateName(body.name, state.participants);
        if (nameCheck.error) return sendJson(res, nameCheck.status || 400, { error: nameCheck.error });

        const pinCheck = validatePin(body.pin);
        if (pinCheck.error) return sendJson(res, 400, { error: pinCheck.error });

        const participant = {
          id: `p_${crypto.randomUUID()}`,
          name: nameCheck.cleanName,
          pin: pinCheck.cleanPin,
          assignedToId: null,
          hasDrawn: false,
          joinedAt: new Date().toISOString()
        };
        state.participants.push(participant);
        const savedMode = await saveEventState(state);
        return sendJson(res, 200, {
          ok: true,
          participantId: participant.id,
          state: sanitizeState(state, savedMode)
        });
      }

      case "admin_reset_pin": {
        if (!verifyAdmin(body, state)) {
          return sendJson(res, 403, { error: "Incorrect Organizer PIN." });
        }
        const participant = state.participants.find((p) => p.id === body.participantId);
        if (!participant) {
          return sendJson(res, 404, { error: "Participant not found." });
        }
        const pinCheck = validatePin(body.newPin);
        if (pinCheck.error) return sendJson(res, 400, { error: pinCheck.error });

        participant.pin = pinCheck.cleanPin;
        const savedMode = await saveEventState(state);
        return sendJson(res, 200, { ok: true, state: sanitizeState(state, savedMode) });
      }

      case "admin_reshuffle": {
        if (!verifyAdmin(body, state)) {
          return sendJson(res, 403, { error: "Incorrect Organizer PIN." });
        }
        if (state.phase !== "DRAWING") {
          return sendJson(res, 409, { error: "Start the draw before re-shuffling." });
        }
        if (state.participants.length < 3) {
          return sendJson(res, 400, { error: "At least 3 participants are required." });
        }
        state.participants = generateSingleCycleDerangement(state.participants);
        const savedMode = await saveEventState(state);
        return sendJson(res, 200, { ok: true, state: sanitizeState(state, savedMode) });
      }

      case "admin_reopen_registration": {
        if (!verifyAdmin(body, state)) {
          return sendJson(res, 403, { error: "Incorrect Organizer PIN." });
        }
        state.phase = "REGISTRATION";
        state.participants = state.participants.map((p) => ({
          ...p,
          assignedToId: null,
          hasDrawn: false
        }));
        const savedMode = await saveEventState(state);
        return sendJson(res, 200, { ok: true, state: sanitizeState(state, savedMode) });
      }

      case "admin_update_settings": {
        if (!verifyAdmin(body, state)) {
          return sendJson(res, 403, { error: "Incorrect Organizer PIN." });
        }
        if (typeof body.eventName === "string") {
          const cleanTitle = body.eventName.trim().replace(/\s+/g, " ");
          if (cleanTitle.length < 2 || cleanTitle.length > 60) {
            return sendJson(res, 400, { error: "Event name must be between 2 and 60 characters." });
          }
          state.eventName = cleanTitle;
        }
        if (typeof body.budget === "string") {
          const cleanBudget = body.budget.trim().replace(/\s+/g, " ");
          if (cleanBudget.length > 40) {
            return sendJson(res, 400, { error: "Budget / note must be 40 characters or less." });
          }
          state.budget = cleanBudget;
        }
        if (body.newAdminPin !== undefined && String(body.newAdminPin).trim() !== "") {
          const pinCheck = validatePin(body.newAdminPin);
          if (pinCheck.error) return sendJson(res, 400, { error: `New Organizer ${pinCheck.error}` });
          state.adminPin = pinCheck.cleanPin;
        }
        const savedMode = await saveEventState(state);
        return sendJson(res, 200, {
          ok: true,
          adminPinUpdated: Boolean(body.newAdminPin && String(body.newAdminPin).trim() !== ""),
          state: sanitizeState(state, savedMode)
        });
      }

      case "admin_reset_all": {
        if (!verifyAdmin(body, state)) {
          return sendJson(res, 403, { error: "Incorrect Organizer PIN." });
        }
        state.participants = [];
        state.phase = "REGISTRATION";
        const savedMode = await saveEventState(state);
        return sendJson(res, 200, { ok: true, state: sanitizeState(state, savedMode) });
      }

      default:
        return sendJson(res, 400, { error: "Unknown action." });
    }
  } catch (err) {
    console.error("[api/event] Error:", err);
    return sendJson(res, 500, { error: "Server error. Please try again." });
  }
}

module.exports = handler;
module.exports.generateSingleCycleDerangement = generateSingleCycleDerangement;
module.exports.sanitizeState = sanitizeState;
module.exports.LOCAL_STATE_FILE = LOCAL_STATE_FILE;
