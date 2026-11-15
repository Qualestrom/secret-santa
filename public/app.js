(() => {
  const POLL_INTERVAL_MS = 4000;
  const LOCAL_JOINED_KEY = "secret_santa_joined_v1";

  let currentState = null;
  let activeAdminPin = null;
  let pollTimer = null;
  let isFetchingState = false;
  let openPinResetId = null;

  // DOM References
  const eventTitleEl = document.getElementById("event-title");
  const eventBudgetWrap = document.getElementById("event-budget-wrap");
  const eventBudgetEl = document.getElementById("event-budget");
  const phaseBadgeEl = document.getElementById("phase-badge");
  const storageModeBadge = document.getElementById("storage-mode-badge");
  const globalStatusEl = document.getElementById("global-status");

  // Registration View
  const registrationView = document.getElementById("registration-view");
  const registerForm = document.getElementById("register-form");
  const regNameInput = document.getElementById("reg-name");
  const regPinInput = document.getElementById("reg-pin");
  const regSubmitBtn = document.getElementById("register-submit-btn");
  const regServerError = document.getElementById("register-server-error");
  const joinedNotice = document.getElementById("joined-notice");
  const joinedNoticeName = document.getElementById("joined-notice-name");
  const lobbyCountText = document.getElementById("lobby-count-text");
  const lobbyEmpty = document.getElementById("lobby-empty");
  const lobbyList = document.getElementById("lobby-list");

  // Drawing View
  const drawingView = document.getElementById("drawing-view");
  const drawProgressCount = document.getElementById("draw-progress-count");
  const drawProgressBar = document.getElementById("draw-progress-bar");
  const drawingGrid = document.getElementById("drawing-grid");

  // Draw Dialog
  const drawDialog = document.getElementById("draw-dialog");
  const drawDialogTitle = document.getElementById("draw-dialog-title");
  const drawPinStep = document.getElementById("draw-pin-step");
  const drawResultStep = document.getElementById("draw-result-step");
  const drawTargetName = document.getElementById("draw-target-name");
  const drawForm = document.getElementById("draw-form");
  const drawParticipantId = document.getElementById("draw-participant-id");
  const drawPinInput = document.getElementById("draw-pin");
  const drawServerError = document.getElementById("draw-server-error");
  const drawSubmitBtn = document.getElementById("draw-submit-btn");
  const drawGiverName = document.getElementById("draw-giver-name");
  const drawRecipientName = document.getElementById("draw-recipient-name");
  const drawBudgetReminder = document.getElementById("draw-budget-reminder");

  // Admin Dialog
  const openAdminBtn = document.getElementById("open-admin-btn");
  const adminDialog = document.getElementById("admin-dialog");
  const adminLoginStep = document.getElementById("admin-login-step");
  const adminPanelStep = document.getElementById("admin-panel-step");
  const adminLoginForm = document.getElementById("admin-login-form");
  const adminPinInput = document.getElementById("admin-pin-input");
  const adminLoginBtn = document.getElementById("admin-login-btn");
  const adminLoginError = document.getElementById("admin-login-error");
  const adminLockBtn = document.getElementById("admin-lock-btn");
  const adminFeedback = document.getElementById("admin-action-feedback");
  const adminPhaseRegControls = document.getElementById("admin-phase-reg-controls");
  const adminPhaseDrawControls = document.getElementById("admin-phase-draw-controls");
  const adminStartHint = document.getElementById("admin-start-hint");
  const adminStartDrawBtn = document.getElementById("admin-start-draw-btn");
  const adminDrawSummary = document.getElementById("admin-draw-summary");
  const adminDrawProgress = document.getElementById("admin-draw-progress");
  const adminReshuffleBtn = document.getElementById("admin-reshuffle-btn");
  const adminReopenBtn = document.getElementById("admin-reopen-btn");
  const adminParticipantList = document.getElementById("admin-participant-list");
  const adminAddWrap = document.getElementById("admin-add-wrap");
  const adminAddForm = document.getElementById("admin-add-form");
  const adminAddName = document.getElementById("admin-add-name");
  const adminAddPin = document.getElementById("admin-add-pin");
  const adminAddSubmitBtn = document.getElementById("admin-add-submit-btn");
  const adminSettingsForm = document.getElementById("admin-settings-form");
  const settingsEventName = document.getElementById("settings-event-name");
  const settingsBudget = document.getElementById("settings-budget");
  const settingsNewPin = document.getElementById("settings-new-pin");
  const settingsSubmitBtn = document.getElementById("admin-settings-submit-btn");
  const adminResetInitial = document.getElementById("admin-reset-initial");
  const adminResetConfirm = document.getElementById("admin-reset-confirm");
  const adminResetPromptBtn = document.getElementById("admin-reset-prompt-btn");
  const adminResetConfirmBtn = document.getElementById("admin-reset-confirm-btn");
  const adminResetCancelBtn = document.getElementById("admin-reset-cancel-btn");

  // ---------------------------------------------------------------------------
  // Modern Web Guidance: Accessible Validation & :user-invalid Sync + Fallback
  // ---------------------------------------------------------------------------
  const supportsUserInvalid = typeof CSS !== "undefined" && CSS.supports && CSS.supports("selector(:user-invalid)");

  const announcer = document.createElement("div");
  announcer.setAttribute("aria-live", "polite");
  announcer.classList.add("visually-hidden");
  document.body.append(announcer);

  let announceTimer = null;
  let announcedField = null;
  const flagged = new WeakSet();
  const announced = new WeakSet();

  const linkError = (el, shown) => {
    const errorId = el.dataset.error;
    if (!errorId) return;
    const ids = (el.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
    else el.removeAttribute("aria-describedby");
  };

  const spokenText = (node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll('[role="img"][aria-label]').forEach((n) => {
      n.replaceWith(`${n.getAttribute("aria-label")}: `);
    });
    return copy.textContent.replace(/\s+/g, " ").trim();
  };

  const announceError = (el) => {
    const error = el.dataset.error ? document.getElementById(el.dataset.error) : null;
    if (!error) return;
    const label = el.labels && el.labels[0] ? `${spokenText(el.labels[0])}: ` : "";
    clearTimeout(announceTimer);
    announcer.textContent = "";
    announcedField = el;
    announceTimer = setTimeout(() => {
      announcer.textContent = label + spokenText(error);
    }, 500);
  };

  const isControlUserInvalid = (el) => {
    if (supportsUserInvalid) {
      return el.matches(":user-invalid");
    }
    return el.classList.contains("user-invalid-fallback");
  };

  const syncAria = (el, announce = false) => {
    if (!el || !el.matches || !el.matches("input, select, textarea")) return;
    const invalid = isControlUserInvalid(el);
    if (invalid) {
      if (announce && !announced.has(el)) {
        announceError(el);
        announced.add(el);
      }
      el.setAttribute("aria-invalid", "true");
      linkError(el, true);
      flagged.add(el);
    } else if (flagged.has(el) || el.getAttribute("aria-invalid") !== "true") {
      el.setAttribute("aria-invalid", "false");
      linkError(el, false);
      flagged.delete(el);
      announced.delete(el);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        announcer.textContent = "";
      }
    }
  };

  const UserInvalidFallback = (() => {
    const dirtyState = new WeakMap();

    const updateState = (input, announce = false) => {
      const isValid = input.validity.valid;
      input.classList.toggle("user-invalid-fallback", !isValid);
      input.classList.toggle("user-valid-fallback", isValid);
      syncAria(input, announce);
    };

    const handleEvent = (event) => {
      const input = event.target;
      if (event.type === "reset") {
        const controls = input.elements || [];
        for (const control of controls) {
          dirtyState.delete(control);
          control.classList.remove("user-invalid-fallback", "user-valid-fallback");
          syncAria(control);
        }
        return;
      }

      if (!input || !input.checkValidity) return;

      if (event.type === "invalid") {
        dirtyState.set(input, { hasInteracted: true, hasBlurred: true });
        announced.add(input);
        updateState(input, false);
        return;
      }

      if (event.type === "input" || event.type === "change") {
        const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        state.hasInteracted = true;
        dirtyState.set(input, state);
        if (state.hasBlurred) {
          updateState(input, event.type === "change");
        }
      } else if (event.type === "blur") {
        const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        state.hasBlurred = true;
        dirtyState.set(input, state);
        if (state.hasInteracted) {
          updateState(input, true);
        }
      }
    };

    const init = (root = document) => {
      if (supportsUserInvalid) return;
      root.addEventListener("blur", handleEvent, true);
      root.addEventListener("input", handleEvent);
      root.addEventListener("change", handleEvent);
      root.addEventListener("invalid", handleEvent, true);
      root.addEventListener("reset", handleEvent, true);
    };

    return { init };
  })();

  function initValidationSync() {
    document.querySelectorAll("input, select, textarea").forEach((el) => syncAria(el));

    if (supportsUserInvalid) {
      document.addEventListener("blur", (e) => syncAria(e.target, true), true);
      document.addEventListener("input", (e) => {
        if (e.target.hasAttribute && e.target.hasAttribute("aria-invalid")) {
          syncAria(e.target);
        }
      });
      document.addEventListener("change", (e) => syncAria(e.target, true), true);
      document.addEventListener(
        "invalid",
        (e) => {
          announced.add(e.target);
          syncAria(e.target);
        },
        true
      );
      document.addEventListener(
        "reset",
        (e) => {
          setTimeout(() => {
            if (e.target && e.target.elements) {
              [...e.target.elements].forEach((el) => syncAria(el));
            }
          });
        },
        true
      );
    } else {
      UserInvalidFallback.init(document);
    }
  }

  // ---------------------------------------------------------------------------
  // Modern Web Guidance: Light-Dismiss Fallback for <dialog closedby="any">
  // ---------------------------------------------------------------------------
  function initDialogHelpers() {
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };

      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener("pointerdown", (e) => {
          pressedOutside = e.target === dialog && outside(e, dialog);
        });
        dialog.addEventListener("pointerup", (e) => {
          if (pressedOutside && e.target === dialog && outside(e, dialog)) {
            dialog.close();
          }
          pressedOutside = false;
        });
      }
    }

    drawDialog.addEventListener("close", () => {
      drawDialog.returnValue = "";
      drawForm.reset();
      hideBox(drawServerError);
      drawPinStep.hidden = false;
      drawResultStep.hidden = true;
    });

    adminDialog.addEventListener("close", () => {
      adminDialog.returnValue = "";
      adminLoginForm.reset();
      hideBox(adminLoginError);
      hideBox(adminFeedback);
      openPinResetId = null;
      adminResetInitial.hidden = false;
      adminResetConfirm.hidden = true;
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function showBox(el, message, isError = false) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    if (el.classList.contains("admin-feedback")) {
      el.classList.toggle("is-error", isError);
    }
  }

  function hideBox(el) {
    if (!el) return;
    el.textContent = "";
    el.hidden = true;
    el.classList.remove("is-error");
  }

  function showGlobalStatus(message) {
    globalStatusEl.textContent = message;
    globalStatusEl.hidden = false;
  }

  function hideGlobalStatus() {
    globalStatusEl.textContent = "";
    globalStatusEl.hidden = true;
  }

  function getSavedParticipant() {
    try {
      const raw = localStorage.getItem(LOCAL_JOINED_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveParticipantLocally(participantId, name) {
    try {
      localStorage.setItem(LOCAL_JOINED_KEY, JSON.stringify({ participantId, name }));
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }

  function clearSavedParticipant() {
    try {
      localStorage.removeItem(LOCAL_JOINED_KEY);
    } catch {
      // Ignore
    }
  }

  function getInitial(name) {
    const trimmed = String(name || "").trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
  }

  async function apiGetState() {
    const res = await fetch("/api/event", { method: "GET", cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to load event state.");
    }
    return data.state;
  }

  async function apiPost(action, payload = {}) {
    const res = await fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || "Request failed.");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function renderState(state) {
    currentState = state;

    // Header
    document.title = `${state.eventName} · Secret Santa`;
    eventTitleEl.textContent = state.eventName;
    if (state.budget && state.budget.trim()) {
      eventBudgetEl.textContent = state.budget;
      eventBudgetWrap.hidden = false;
    } else {
      eventBudgetWrap.hidden = true;
    }

    const isDrawing = state.phase === "DRAWING";
    phaseBadgeEl.textContent = isDrawing ? "Phase 2: Drawing Open" : "Phase 1: Registration Open";
    phaseBadgeEl.classList.toggle("badge-phase-drawing", isDrawing);

    storageModeBadge.textContent =
      state.storageMode === "vercel-storage"
        ? "Synced via Vercel Storage"
        : "Local Dev Storage Mode";

    // Sync localStorage notice with live participant list
    let savedMe = getSavedParticipant();
    if (savedMe && !state.participants.some((p) => p.id === savedMe.participantId)) {
      clearSavedParticipant();
      savedMe = null;
    }

    if (savedMe && !isDrawing) {
      joinedNoticeName.textContent = savedMe.name;
      joinedNotice.hidden = false;
    } else {
      joinedNotice.hidden = true;
    }

    // Phase Views
    registrationView.hidden = isDrawing;
    drawingView.hidden = !isDrawing;

    if (!isDrawing) {
      renderLobby(state.participants, savedMe);
    } else {
      renderDrawingGrid(state.participants, savedMe);
    }

    if (activeAdminPin && adminDialog.open) {
      renderAdminPanel(state);
    }
  }

  function renderLobby(participants, savedMe) {
    const count = participants.length;
    lobbyCountText.textContent = `${count} ${count === 1 ? "participant" : "participants"} joined`;

    lobbyList.innerHTML = "";
    if (count === 0) {
      lobbyEmpty.hidden = false;
      lobbyList.hidden = true;
      return;
    }

    lobbyEmpty.hidden = true;
    lobbyList.hidden = false;

    for (const p of participants) {
      const li = document.createElement("li");
      li.className = "lobby-item";
      const isYou = savedMe && savedMe.participantId === p.id;
      if (isYou) li.classList.add("lobby-item-you");

      const avatar = document.createElement("span");
      avatar.className = "avatar-circle";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = getInitial(p.name);

      const label = document.createElement("span");
      label.textContent = isYou ? `${p.name} (You)` : p.name;

      li.append(avatar, label);
      lobbyList.append(li);
    }
  }

  function renderDrawingGrid(participants, savedMe) {
    const total = participants.length;
    const drawnCount = participants.filter((p) => p.hasDrawn).length;
    drawProgressCount.textContent = `${drawnCount} / ${total}`;
    drawProgressBar.max = Math.max(total, 1);
    drawProgressBar.value = drawnCount;

    drawingGrid.innerHTML = "";
    for (const p of participants) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "participant-draw-card";
      if (p.hasDrawn) btn.classList.add("is-drawn");

      const top = document.createElement("div");
      top.className = "draw-card-top";

      const avatar = document.createElement("span");
      avatar.className = "avatar-circle";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = getInitial(p.name);

      const nameEl = document.createElement("span");
      nameEl.className = "draw-card-name";
      const isYou = savedMe && savedMe.participantId === p.id;
      nameEl.textContent = isYou ? `${p.name} (You)` : p.name;

      top.append(avatar, nameEl);

      const status = document.createElement("span");
      status.className = `draw-status-pill ${p.hasDrawn ? "pill-done" : "pill-pending"}`;
      status.textContent = p.hasDrawn ? "✅ Drawn · Tap to Re-check" : "🎁 Tap to Draw";

      btn.append(top, status);
      btn.addEventListener("click", () => openDrawModal(p));
      drawingGrid.append(btn);
    }
  }

  function renderAdminPanel(state) {
    const isDrawing = state.phase === "DRAWING";
    const total = state.participants.length;
    const drawnCount = state.participants.filter((p) => p.hasDrawn).length;

    adminPhaseRegControls.hidden = isDrawing;
    adminPhaseDrawControls.hidden = !isDrawing;
    adminAddWrap.hidden = isDrawing;

    if (!isDrawing) {
      const enough = total >= 3;
      adminStartDrawBtn.disabled = !enough;
      adminStartHint.textContent = enough
        ? `${total} participants ready. Locking registration will randomly assign everyone a secret match.`
        : `Need at least 3 participants to start (${total} joined so far).`;
    } else {
      adminDrawSummary.textContent = `${drawnCount} of ${total} participants have drawn`;
      adminDrawProgress.max = Math.max(total, 1);
      adminDrawProgress.value = drawnCount;
    }

    if (!adminSettingsForm.contains(document.activeElement)) {
      settingsEventName.value = state.eventName;
      settingsBudget.value = state.budget || "";
    }

    adminParticipantList.innerHTML = "";
    if (total === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "admin-list-item";
      emptyLi.textContent = "No participants have joined yet.";
      adminParticipantList.append(emptyLi);
      return;
    }

    for (const p of state.participants) {
      const li = document.createElement("li");
      li.className = "admin-list-item";

      const mainRow = document.createElement("div");
      mainRow.className = "admin-list-main";

      const meta = document.createElement("div");
      meta.className = "admin-person-meta";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = p.name;

      const statusPill = document.createElement("span");
      statusPill.className = `draw-status-pill ${
        isDrawing ? (p.hasDrawn ? "pill-done" : "pill-pending") : "pill-done"
      }`;
      statusPill.textContent = isDrawing ? (p.hasDrawn ? "✅ Drawn" : "⏳ Waiting") : "Joined";

      meta.append(nameSpan, statusPill);

      const actions = document.createElement("div");
      actions.className = "admin-person-actions";

      const resetPinBtn = document.createElement("button");
      resetPinBtn.type = "button";
      resetPinBtn.className = "btn btn-ghost btn-sm";
      resetPinBtn.textContent = "Reset PIN";
      resetPinBtn.addEventListener("click", () => {
        openPinResetId = openPinResetId === p.id ? null : p.id;
        renderAdminPanel(currentState);
      });
      actions.append(resetPinBtn);

      if (!isDrawing) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-ghost btn-sm";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => handleAdminRemove(p));
        actions.append(removeBtn);
      }

      mainRow.append(meta, actions);
      li.append(mainRow);

      if (openPinResetId === p.id) {
        const resetForm = document.createElement("form");
        resetForm.className = "admin-pin-reset-form";
        resetForm.method = "POST";
        resetForm.action = "/api/event";
        resetForm.setAttribute("aria-label", `Reset PIN for ${p.name}`);

        const group = document.createElement("div");
        group.className = "form-group";

        const pinInputId = `reset-pin-${p.id}`;
        const label = document.createElement("label");
        label.setAttribute("for", pinInputId);
        label.textContent = `New 4-Digit PIN for ${p.name}`;

        const input = document.createElement("input");
        input.type = "text";
        input.id = pinInputId;
        input.name = "newPin";
        input.inputMode = "numeric";
        input.pattern = "\\d{4}";
        input.minLength = 4;
        input.maxLength = 4;
        input.required = true;
        input.autocomplete = "off";
        input.placeholder = "4 digits";

        group.append(label, input);
        syncAria(input);

        const saveBtn = document.createElement("button");
        saveBtn.type = "submit";
        saveBtn.className = "btn btn-primary btn-sm";
        saveBtn.textContent = "Save PIN";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "btn btn-secondary btn-sm";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", () => {
          openPinResetId = null;
          renderAdminPanel(currentState);
        });

        resetForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          saveBtn.disabled = true;
          hideBox(adminFeedback);
          try {
            const res = await apiPost("admin_reset_pin", {
              adminPin: activeAdminPin,
              participantId: p.id,
              newPin: input.value.trim()
            });
            openPinResetId = null;
            renderState(res.state);
            showBox(adminFeedback, `Updated PIN for ${p.name}.`);
          } catch (err) {
            showBox(adminFeedback, err.message, true);
          } finally {
            saveBtn.disabled = false;
          }
        });

        resetForm.append(group, saveBtn, cancelBtn);
        li.append(resetForm);
      }

      adminParticipantList.append(li);
    }
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBox(regServerError);
    hideGlobalStatus();

    const name = regNameInput.value.trim();
    const pin = regPinInput.value.trim();
    regSubmitBtn.disabled = true;

    try {
      const data = await apiPost("register", { name, pin });
      saveParticipantLocally(data.participantId, name);
      registerForm.reset();
      renderState(data.state);
      showGlobalStatus(`Welcome, ${name}! You're in the Secret Santa pool.`);
    } catch (err) {
      showBox(regServerError, err.message);
      if (err.status === 409) {
        refreshStateNow();
      }
    } finally {
      regSubmitBtn.disabled = false;
    }
  });

  function openDrawModal(participant) {
    drawDialogTitle.textContent = participant.hasDrawn ? "Re-check Your Match" : "Draw Your Secret Santa";
    drawTargetName.textContent = participant.name;
    drawParticipantId.value = participant.id;
    drawPinInput.value = "";
    hideBox(drawServerError);
    drawPinStep.hidden = false;
    drawResultStep.hidden = true;
    drawDialog.showModal();
  }

  drawForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBox(drawServerError);

    const participantId = drawParticipantId.value;
    const pin = drawPinInput.value.trim();
    drawSubmitBtn.disabled = true;

    try {
      const data = await apiPost("draw", { participantId, pin });
      renderState(data.state);

      drawGiverName.textContent = data.participantName;
      drawRecipientName.textContent = data.assignedToName;
      if (data.state.budget && data.state.budget.trim()) {
        drawBudgetReminder.textContent = `Reminder: ${data.state.budget}`;
        drawBudgetReminder.hidden = false;
      } else {
        drawBudgetReminder.hidden = true;
      }

      drawPinStep.hidden = true;
      drawResultStep.hidden = false;
      const doneBtn = drawResultStep.querySelector('button[type="submit"]');
      if (doneBtn) doneBtn.focus();
    } catch (err) {
      showBox(drawServerError, err.message);
      drawPinInput.select();
    } finally {
      drawSubmitBtn.disabled = false;
    }
  });

  openAdminBtn.addEventListener("click", () => {
    hideBox(adminLoginError);
    hideBox(adminFeedback);
    if (activeAdminPin) {
      adminLoginStep.hidden = true;
      adminPanelStep.hidden = false;
      renderAdminPanel(currentState);
    } else {
      adminLoginStep.hidden = false;
      adminPanelStep.hidden = true;
      adminPinInput.value = "";
    }
    adminDialog.showModal();
  });

  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBox(adminLoginError);
    const pin = adminPinInput.value.trim();
    adminLoginBtn.disabled = true;

    try {
      const data = await apiPost("admin_verify", { adminPin: pin });
      activeAdminPin = pin;
      adminLoginForm.reset();
      adminLoginStep.hidden = true;
      adminPanelStep.hidden = false;
      renderState(data.state);
      renderAdminPanel(data.state);
    } catch (err) {
      showBox(adminLoginError, err.message);
      adminPinInput.select();
    } finally {
      adminLoginBtn.disabled = false;
    }
  });

  adminLockBtn.addEventListener("click", () => {
    activeAdminPin = null;
    openPinResetId = null;
    adminPanelStep.hidden = true;
    adminLoginStep.hidden = false;
    adminPinInput.value = "";
    adminPinInput.focus();
  });

  adminStartDrawBtn.addEventListener("click", async () => {
    adminStartDrawBtn.disabled = true;
    hideBox(adminFeedback);
    try {
      const data = await apiPost("admin_start_draw", { adminPin: activeAdminPin });
      renderState(data.state);
      showBox(adminFeedback, "Registration locked and secret pairings generated! Everyone can now draw.");
    } catch (err) {
      showBox(adminFeedback, err.message, true);
    } finally {
      if (currentState && currentState.phase === "REGISTRATION") {
        adminStartDrawBtn.disabled = currentState.participants.length < 3;
      }
    }
  });

  adminReshuffleBtn.addEventListener("click", async () => {
    adminReshuffleBtn.disabled = true;
    hideBox(adminFeedback);
    try {
      const data = await apiPost("admin_reshuffle", { adminPin: activeAdminPin });
      renderState(data.state);
      showBox(adminFeedback, "All pairings have been freshly re-shuffled and draw statuses reset.");
    } catch (err) {
      showBox(adminFeedback, err.message, true);
    } finally {
      adminReshuffleBtn.disabled = false;
    }
  });

  adminReopenBtn.addEventListener("click", async () => {
    adminReopenBtn.disabled = true;
    hideBox(adminFeedback);
    try {
      const data = await apiPost("admin_reopen_registration", { adminPin: activeAdminPin });
      renderState(data.state);
      showBox(adminFeedback, "Registration re-opened! Previous matches were cleared.");
    } catch (err) {
      showBox(adminFeedback, err.message, true);
    } finally {
      adminReopenBtn.disabled = false;
    }
  });

  async function handleAdminRemove(participant) {
    hideBox(adminFeedback);
    try {
      const data = await apiPost("admin_remove_participant", {
        adminPin: activeAdminPin,
        participantId: participant.id
      });
      renderState(data.state);
      showBox(adminFeedback, `Removed ${participant.name} from the pool.`);
    } catch (err) {
      showBox(adminFeedback, err.message, true);
    }
  }

  adminAddForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBox(adminFeedback);
    adminAddSubmitBtn.disabled = true;
    const name = adminAddName.value.trim();
    const pin = adminAddPin.value.trim();

    try {
      const data = await apiPost("admin_add_participant", {
        adminPin: activeAdminPin,
        name,
        pin
      });
      adminAddForm.reset();
      renderState(data.state);
      showBox(adminFeedback, `Added ${name} to the participant pool.`);
    } catch (err) {
      showBox(adminFeedback, err.message, true);
    } finally {
      adminAddSubmitBtn.disabled = false;
    }
  });

  adminSettingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBox(adminFeedback);
    settingsSubmitBtn.disabled = true;

    const eventName = settingsEventName.value.trim();
    const budget = settingsBudget.value.trim();
    const newAdminPin = settingsNewPin.value.trim();

    try {
      const data = await apiPost("admin_update_settings", {
        adminPin: activeAdminPin,
        eventName,
        budget,
        newAdminPin
      });
      if (data.adminPinUpdated && newAdminPin) {
        activeAdminPin = newAdminPin;
      }
      settingsNewPin.value = "";
      syncAria(settingsNewPin);
      renderState(data.state);
      showBox(adminFeedback, "Event settings saved.");
    } catch (err) {
      showBox(adminFeedback, err.message, true);
    } finally {
      settingsSubmitBtn.disabled = false;
    }
  });

  adminResetPromptBtn.addEventListener("click", () => {
    adminResetInitial.hidden = true;
    adminResetConfirm.hidden = false;
    adminResetCancelBtn.focus();
  });

  adminResetCancelBtn.addEventListener("click", () => {
    adminResetConfirm.hidden = true;
    adminResetInitial.hidden = false;
    adminResetPromptBtn.focus();
  });

  adminResetConfirmBtn.addEventListener("click", async () => {
    adminResetConfirmBtn.disabled = true;
    hideBox(adminFeedback);
    try {
      const data = await apiPost("admin_reset_all", { adminPin: activeAdminPin });
      clearSavedParticipant();
      adminResetConfirm.hidden = true;
      adminResetInitial.hidden = false;
      renderState(data.state);
      showBox(adminFeedback, "Event reset. Ready for a new group!");
    } catch (err) {
      showBox(adminFeedback, err.message, true);
    } finally {
      adminResetConfirmBtn.disabled = false;
    }
  });

  // ---------------------------------------------------------------------------
  // Polling & Initialization
  // ---------------------------------------------------------------------------
  async function refreshStateNow() {
    if (isFetchingState) return;
    isFetchingState = true;
    try {
      const state = await apiGetState();
      renderState(state);
    } catch (err) {
      console.warn("Polling error:", err.message);
    } finally {
      isFetchingState = false;
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshStateNow();
      }
    }, POLL_INTERVAL_MS);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshStateNow();
    }
  });

  initValidationSync();
  initDialogHelpers();
  refreshStateNow().then(startPolling);
})();
