import { createSourceEnrollmentStore } from "./source-enrollments.mjs";
import {
  syntaxOptions,
  parseStoredSchedule,
  validateStoredSchedule,
} from "./schedule-validation.mjs";
import fs from "node:fs";
import {
  createScheduleStore,
  createExternalScheduleCoordinator,
  evaluateSchedule,
} from "../../shared/scheduled-settings.mjs";
import { createSqliteScheduleAdapter, createSqliteScheduleDiscardStore } from "./schedule-store.mjs";
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
  const enrollmentStore = createSourceEnrollmentStore({
    directory,
    profileId,
    vault,
  });
  let enrolledCount = sourceEnrollments.length,
    enrollmentHealthy = true,
    enrollmentIdentity = null,
    enrolledKinds = new Map(
      sourceEnrollments.map((entry) => [entry.origin, entry.kind]),
    );
  const options = {
    registry: CURRENT_SCHEDULE_REGISTRY,
    allowedOrigins: [],
    allowLoopbackHttp: sourceEnrollments.some(
      (entry) => entry.developmentLoopback,
    ),
  };
  const buildProvider = (entries) =>
    createScheduleSourceProvider({
      enrollments: entries,
      registry: CURRENT_SCHEDULE_REGISTRY,
      vault,
      lookup,
      trustedCa,
    });
  let provider = buildProvider(sourceEnrollments),
    coordinator = createExternalScheduleCoordinator(options);
  const adapter =
    storageAdapter ??
    createSqliteScheduleAdapter({
      directory,
      profileId,
      ...options,
      allowUnenrolledSources: true,
    });
  const store = {
    async load() {
      const bytes = await adapter.read();
      return bytes === null ? null : parseStoredSchedule(bytes, options);
    },
  };
  let discardStore;
  const drafts = () => discardStore ??= createSqliteScheduleDiscardStore({directory,profileId,registry:CURRENT_SCHEDULE_REGISTRY,clock});

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
    externalAvailable: enrollmentHealthy && enrolledCount > 0 && !closed,
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
      if (document) {
        coordinator.cancel();
        coordinator = createExternalScheduleCoordinator(
          syntaxOptions(document, options),
        );
        coordinator.reset(document);
      } else coordinator.cancel();
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
          ...syntaxOptions(document, options),
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
    if (document)
      for (const issue of [...issues.values()]) {
        const rule = document.rules.find((rule) => rule.id === issue.ruleId);
        if (rule && rule.source.type !== "local") {
          const origin = new URL(
            rule.source.type === "https"
              ? rule.source.url
              : rule.source.baseUrl,
          ).origin;
          if (!enrollmentHealthy)
            issues.set(rule.id, {
              ruleId: rule.id,
              code: "SOURCE_ENROLLMENTS_UNAVAILABLE",
            });
          else if (enrolledKinds.get(origin) !== rule.source.type)
            issues.set(rule.id, {
              ruleId: rule.id,
              code: "SOURCE_NOT_ENROLLED",
            });
        }
      }
    result.issues = [...issues.values()];
    return result;
  }
  function now() {
    const value = clock();
    if (!Number.isFinite(value)) fail("SCHEDULE_CLOCK_UNAVAILABLE");
    return value;
  }
  async function syncEnrollments(force = false) {
    let bindings,
      key,
      healthy = true;
    const observed = generation;
    try {
      bindings = await enrollmentStore.bindings();
      if (observed !== generation) bindings = await enrollmentStore.bindings();
      key = JSON.stringify(bindings);
    } catch {
      healthy = false;
      bindings = { entries: [] };
      key = "unavailable";
    }
    if (closed) return;
    if (!force && key === enrollmentIdentity) return;
    enrollmentIdentity = key;
    enrollmentHealthy = healthy;
    generation++;
    provider.close();
    coordinator.cancel();
    providerIssues.clear();
    try {
      const entries = healthy
        ? [...sourceEnrollments, ...bindings.entries]
        : [];
      provider = buildProvider(entries);
      enrolledCount = entries.length;
      enrolledKinds = new Map(
        entries.map((entry) => [entry.origin, entry.kind]),
      );
    } catch {
      provider = buildProvider([]);
      enrolledCount = 0;
      enrollmentHealthy = false;
      enrolledKinds.clear();
    }
    if (current) {
      coordinator = createExternalScheduleCoordinator(
        syntaxOptions(current, options),
      );
      coordinator.reset(current);
    }
  }
  async function cycle() {
    if (cyclePromise) return cyclePromise;
    cyclePromise = (async () => {
      try {
        await syncEnrollments();
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
    async draftDiscard({document,authorize=()=>true}) {
      ready();
      if(typeof authorize!=="function" || authorize()!==true) fail("UNAUTHORIZED");
      return drafts().append({document,authorize});
    },
    async draftList({after=0,limit=20,authorize=()=>true}={}) {
      ready();
      if(typeof authorize!=="function" || authorize()!==true) fail("UNAUTHORIZED");
      return drafts().list({after,limit,authorize});
    },
    async draftRead({sequence,authorize=()=>true}) {
      ready();
      if(typeof authorize!=="function" || authorize()!==true) fail("UNAUTHORIZED");
      return drafts().read({sequence,authorize});
    },
    async enrollmentList() {
      ready();
      try {
        return await enrollmentStore.list();
      } catch (error) {
        await syncEnrollments(true);
        await cycle();
        throw error;
      }
    },
    async enrollmentSave(input) {
      ready();
      try {
        const result = await enrollmentStore.save(input);
        await syncEnrollments();
        await cycle();
        if (!available) await cycle();
        return result;
      } catch (error) {
        if (error.code !== "UNAUTHORIZED") await syncEnrollments(true);
        await cycle();
        throw error;
      }
    },
    async enrollmentRemove(input) {
      ready();
      try {
        const result = await enrollmentStore.remove(input);
        await syncEnrollments();
        await cycle();
        if (!available) await cycle();
        return result;
      } catch (error) {
        if (error.code !== "UNAUTHORIZED") await syncEnrollments(true);
        await cycle();
        throw error;
      }
    },
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
      const replacementOptions = syntaxOptions(document, options);
      validateStoredSchedule(document, replacementOptions);
      const scoped = {
        async read() {
          permitted();
          const bytes = await adapter.read();
          permitted();
          if (bytes !== null) {
            const prior = parseStoredSchedule(bytes, options);
            replacementOptions.allowedOrigins.splice(
              0,
              replacementOptions.allowedOrigins.length,
              ...new Set([
                ...replacementOptions.allowedOrigins,
                ...syntaxOptions(prior, options).allowedOrigins,
              ]),
            );
          }
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
          ...replacementOptions,
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
    async historyRead({revision,authorize=()=>true}) {
      ready();
      if(authorize()!==true)fail("UNAUTHORIZED");
      const record=await adapter.historyRead({revision});
      if(authorize()!==true)fail("UNAUTHORIZED");
      return record;
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
      discardStore?.close();
      enrollmentStore.close();
      listeners.clear();
    },
  });
}
