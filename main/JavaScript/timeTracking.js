(() => {
  const HEARTBEAT_MS = 30_000;
  const IDLE_MS = 5 * 60_000;

  function createWorkTimer(target, onTick = () => {}) {
    let entry = null;
    let heartbeatTimer = null;
    let displayTimer = null;
    let lastActivity = Date.now();
    let seconds = 0;
    let stopped = false;

    const activity = () => { lastActivity = Date.now(); };
    const emit = () => onTick(seconds);

    async function start() {
      if (stopped || document.hidden || entry) return;
      entry = await window.AAIR.request('/work-time/start', { method: 'POST', json: target });
      seconds = Number(entry.active_seconds || 0);
      emit();
      heartbeatTimer = window.setInterval(beat, HEARTBEAT_MS);
      displayTimer = window.setInterval(() => {
        if (!document.hidden && Date.now() - lastActivity < IDLE_MS) { seconds += 1; emit(); }
      }, 1000);
    }

    async function beat() {
      if (!entry) return;
      if (document.hidden) { await pause('PAGE_HIDDEN'); return; }
      if (Date.now() - lastActivity >= IDLE_MS) { await pause('IDLE'); return; }
      try {
        entry = await window.AAIR.request(`/work-time/${entry.id}/heartbeat`, { method: 'POST' });
        seconds = Number(entry.active_seconds || seconds); emit();
      } catch (error) { console.warn('Time tracking heartbeat failed', error); }
    }

    async function pause(reason) {
      window.clearInterval(heartbeatTimer); window.clearInterval(displayTimer);
      heartbeatTimer = null; displayTimer = null;
      const current = entry; entry = null;
      if (!current) return;
      try {
        const result = await window.AAIR.request(`/work-time/${current.id}/stop`, { method: 'POST', json: { reason } });
        seconds = Number(result.active_seconds || seconds); emit();
      } catch (error) { console.warn('Time tracking stop failed', error); }
    }

    async function stop(reason = 'MANUAL', restart = false) {
      await pause(reason);
      if (restart) { lastActivity = Date.now(); await start(); }
      else stopped = true;
    }

    async function visibility() {
      if (document.hidden) await pause('PAGE_HIDDEN');
      else if (!stopped) { lastActivity = Date.now(); await start(); }
    }

    ['pointerdown', 'keydown', 'input', 'scroll'].forEach(name => document.addEventListener(name, activity, { passive: true }));
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', () => { pause('PAGE_HIDDEN'); });
    start().catch(error => console.warn('Time tracking start failed', error));
    return { stop, pause, get seconds() { return seconds; } };
  }

  window.AAIR = window.AAIR || {};
  window.AAIR.createWorkTimer = createWorkTimer;
})();
