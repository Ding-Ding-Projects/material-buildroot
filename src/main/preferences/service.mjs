import fs from "node:fs";
import {
  createScheduleStore,
  createExternalScheduleCoordinator,
  evaluateSchedule,
} from "../../shared/scheduled-settings.mjs";
import { createSqliteScheduleAdapter } from "./schedule-store.mjs";
import { createScheduleSourceProvider } from "./schedule-provider.mjs";
export const CURRENT_SCHEDULE_REGISTRY = Object.freeze({
  language: (value) => ["en", "zh-HK", "bilingual"].includes(value),
  "appearance.theme": (value) => ["system", "light", "dark"].includes(value),
});
export class SchedulePreferencesError extends Error {
  constructor(code) {
    super("Scheduled preferences are unavailable.");
    this.name = "SchedulePreferencesError";
    this.code = code;
  }
}
const fail = (code) => {
    throw new SchedulePreferencesError(code);
  },
  copy = (value) => JSON.parse(JSON.stringify(value));
export function createSchedulePreferencesService({
  directory,
  profileId,
  baseReader,
  sourceEnrollments = [],
  vault,
  clock = Date.now,
  tickMs = 1000,
  watchFactory = fs.watch,
  lookup,
  trustedCa,
  storageAdapter,
} = {}) {
  if (
    typeof baseReader !== "function" ||
    typeof clock !== "function" ||
    typeof watchFactory !== "function" ||
    !Number.isInteger(tickMs) ||
    tickMs < 1000 ||
    tickMs > 60000
  )
    fail("INVALID_SCHEDULE_SERVICE");
  const provider = createScheduleSourceProvider({
      enrollments: sourceEnrollments,
      registry: CURRENT_SCHEDULE_REGISTRY,
      vault,
      lookup,
      trustedCa,
    }),
    options = provider.options(),
    adapter =
      storageAdapter ??
      createSqliteScheduleAdapter({ directory, profileId, ...options }),
    store = createScheduleStore({ adapter, ...options }),
    coordinator = createExternalScheduleCoordinator(options);
  let current = null,
    identity = null,
    generation = 0,
    started = false,
    closed = false,
    watching = false,
    available = false,
    effective = null,
    evaluatedAt = null,
    watcher,
    timer,
    retryTimer,
    retries = 0,
    cyclePromise = null,
    refreshPromise = null,
    pausedUntil = 0,
    lastEvent = "";
  const listeners = new Set(),
    providerIssues = new Map();
  const snapshot = () => ({
    available: available && watching && !closed,
    watching: watching && !closed,
    running: started && !closed,
    revision: current?.revision ?? null,
    externalAvailable: sourceEnrollments.length > 0 && !closed,
    effective: available && watching && !closed ? copy(effective) : null,
    evaluatedAt: available && watching && !closed ? evaluatedAt : null,
  });
  const emit = () => {
    if (closed) return;
    const state = snapshot(),
      encoded = JSON.stringify(state);
    if (encoded === lastEvent) return;
    lastEvent = encoded;
    for (const listener of listeners) {
      try {
        listener(copy(state));
      } catch {}
    }
  };
  const ready = () => {
    if (!started || closed) fail("SCHEDULE_SERVICE_CLOSED");
  };
  function update(document) {
    const next = JSON.stringify(document);
    if (next !== identity) {
      generation++;
      current = document;
      identity = next;
      providerIssues.clear();
      if (document) coordinator.reset(document);
      else coordinator.cancel();
    }
  }
  async function load() {
    ready();
    let observed = generation,
      document = await store.load();
    if (observed !== generation) {
      observed = generation;
      document = await store.load();
      if (observed !== generation) fail("SCHEDULE_EVALUATION_SUPERSEDED");
    }
    if (closed) fail("SCHEDULE_SERVICE_CLOSED");
    update(document);
    return document ? copy(document) : null;
  }
  async function calculate(at) {
    const observed = generation,
      document = current,
      base = await baseReader();
    if (closed || observed !== generation)
      fail("SCHEDULE_EVALUATION_SUPERSEDED");
    if (
      !base ||
      Object.keys(base).length !== 2 ||
      !Object.hasOwn(base, "language") ||
      !Object.hasOwn(base, "appearance.theme") ||
      !CURRENT_SCHEDULE_REGISTRY.language(base.language) ||
      !CURRENT_SCHEDULE_REGISTRY["appearance.theme"](base["appearance.theme"])
    )
      fail("SCHEDULE_BASE_UNAVAILABLE");
    const result = document
      ? evaluateSchedule({
          document,
          base,
          at,
          external: coordinator.snapshot(),
          ...options,
        })
      : {
          values: copy(base),
          provenance: { language: null, "appearance.theme": null },
          appliedRuleIds: [],
          issues: [],
        };
    const issues = new Map(result.issues.map((issue) => [issue.ruleId, issue]));
    for (const [ruleId, code] of providerIssues)
      issues.set(ruleId, { ruleId, code });
    result.issues = [...issues.values()];
    return result;
  }
  function now() {
    const value = clock();
    if (!Number.isFinite(value)) fail("SCHEDULE_CLOCK_UNAVAILABLE");
    return value;
  }
  async function cycle() {
    if (cyclePromise) return cyclePromise;
    cyclePromise = (async () => {
      try {
        await load();
        const at = now();
        if (current) coordinator.reconcile(current, at);
        const result = await calculate(at);
        available = true;
        effective = result;
        evaluatedAt = at;
        emit();
      } catch {
        available = false;
        emit();
      }
    })().finally(() => (cyclePromise = null));
    return cyclePromise;
  }
  function attach() {
    if (closed) return;
    try {
      watcher = watchFactory(directory, { persistent: false }, () => {
        void cycle();
      });
      if (
        !watcher ||
        typeof watcher.on !== "function" ||
        typeof watcher.close !== "function"
      )
        fail("SCHEDULE_WATCH_UNAVAILABLE");
      const candidate = watcher;
      const broken = () => {
        if (closed || watcher !== candidate) return;
        watching = false;
        available = false;
        watcher = undefined;
        try {
          candidate.close();
        } catch {}
        emit();
        if (retries++ < 3) {
          retryTimer = setTimeout(() => {
            retryTimer = undefined;
            attach();
          }, 100);
          retryTimer.unref?.();
        }
      };
      watcher.on("error", broken);
      watcher.on("close", broken);
      watching = true;
      void cycle();
    } catch {
      watching = false;
      available = false;
      emit();
      if (retries++ < 3) {
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          attach();
        }, 100);
        retryTimer.unref?.();
      }
    }
  }
  async function refresh() {
    ready();
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      await cycle();
      const document = current,
        observed = generation;
      if (!document || !available || !watching) return snapshot();
      const at = now();
      if (at < pausedUntil) return snapshot();
      coordinator.reconcile(document, at);
      const due = document.rules.filter((rule) => rule.source.type !== "local");
      let cursor = 0;
      const worker = async () => {
        while (cursor < due.length) {
          if (closed || observed !== generation) return;
          const rule = due[cursor++];
          let token;
          try {
            token = coordinator.begin(document, rule.id, now());
          } catch (error) {
            if (!["INACTIVE_RULE", "REFRESH_LIMIT"].includes(error.code))
              providerIssues.set(rule.id, "SOURCE_UNAVAILABLE");
            continue;
          }
          try {
            const bytes = await provider.request(rule, {
              signal: token.signal,
            });
            if (closed || observed !== generation) return;
            if (coordinator.settleBytes(token, bytes, now()))
              providerIssues.delete(rule.id);
            else providerIssues.set(rule.id, "SOURCE_INVALID");
          } catch (error) {
            if (closed || observed !== generation || token.signal.aborted)
              return;
            coordinator.settle(
              token,
              { schemaVersion: 1, status: "failed", values: {} },
              now(),
            );
            providerIssues.set(
              rule.id,
              /^SOURCE_[A-Z_]+$/.test(error.code || "")
                ? error.code
                : "SOURCE_UNAVAILABLE",
            );
          }
        }
      };
      await Promise.allSettled(
        Array.from({ length: Math.min(2, due.length) }, () => worker()),
      );
      if (!closed && observed === generation) await cycle();
      return snapshot();
    })().finally(() => (refreshPromise = null));
    return refreshPromise;
  }
  return Object.freeze({
    async start() {
      if (closed) fail("SCHEDULE_SERVICE_CLOSED");
      if (started) return snapshot();
      started = true;
      attach();
      await cycle();
      timer = setInterval(() => {
        void cycle();
        void refresh().catch(() => {});
      }, tickMs);
      timer.unref?.();
      return snapshot();
    },
    read: load,
    async replace({ document, expectedRevision, authorize = () => true }) {
      ready();
      const permitted = () => {
        let allowed = false;
        try {
          allowed =
            !closed && typeof authorize === "function" && authorize() === true;
        } catch {}
        if (!allowed) fail("UNAUTHORIZED");
      };
      permitted();
      // The authorizer belongs to this invocation, never mutable shared service state.
      const scoped = {
        async read() {
          permitted();
          const bytes = await adapter.read();
          permitted();
          return bytes;
        },
        commit(transaction) {
          permitted();
          return adapter.commit(transaction);
        },
      };
      let saved;
      try {
        saved = await createScheduleStore({
          adapter: scoped,
          ...options,
        }).replace(document, { expectedRevision });
      } catch (error) {
        permitted();
        throw error;
      }
      permitted();
      if (!current || saved.revision >= current.revision) update(saved);
      pausedUntil = 0;
      void cycle();
      return copy(saved);
    },
    async history(page) {
      ready();
      return adapter.history(page);
    },
    async evaluate({ at = now() } = {}) {
      await load();
      return calculate(at);
    },
    refresh,
    async cancel() {
      ready();
      coordinator.cancel();
      provider.cancelAll();
      providerIssues.clear();
      generation++;
      identity = null;
      pausedUntil = now() + 30000;
      await cycle();
      if (!available) await cycle();
      return snapshot();
    },
    status: snapshot,
    subscribe(listener) {
      if (typeof listener !== "function") fail("INVALID_SCHEDULE_LISTENER");
      listeners.add(listener);
      try {
        listener(snapshot());
      } catch {}
      return () => listeners.delete(listener);
    },
    close() {
      closed = true;
      available = false;
      watching = false;
      generation++;
      coordinator.cancel();
      provider.close();
      if (timer) clearInterval(timer);
      if (retryTimer) clearTimeout(retryTimer);
      try {
        watcher?.close();
      } catch {}
      adapter.close();
      listeners.clear();
    },
  });
}
