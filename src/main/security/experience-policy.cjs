"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  storage = require("../jobs/storage.cjs");
const { verifyTotp, decodeBase32 } = require("./authenticator.cjs");
const policies = {
  pin: ["pin"],
  password: ["password"],
  "pin+password": ["pin", "password"],
  "password+totp": ["password", "totp"],
  "pin+totp": ["pin", "totp"],
  "password+pin+totp": ["password", "pin", "totp"],
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const id = (x) => typeof x === "string" && x.length > 0 && x.length <= 256;
const finite = (x) => Number.isSafeInteger(x) && x >= 0;
function hash(value, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(value, salt, 32).toString("hex") };
}
function matches(value, stored) {
  if (typeof value !== "string" || value.length > 1024 || !stored) return false;
  const actual = hash(value, stored.salt).hash;
  return (
    typeof stored.hash === "string" &&
    stored.hash.length === actual.length &&
    crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(stored.hash))
  );
}
function createExperiencePolicyService({
  directory,
  vault,
  now = Date.now,
  openFolder,
  attempts = 5,
  waitMs = 30000,
}) {
  if (
    !vault ||
    typeof vault.read !== "function" ||
    typeof vault.write !== "function" ||
    !Number.isInteger(attempts) ||
    attempts < 1 ||
    attempts > 20 ||
    !finite(waitMs) ||
    waitMs < 1
  )
    throw Error("Invalid experience policy configuration");
  directory = storage.directory(directory);
  const file = path.join(directory, "experience-policies.json");
  let data = { version: 1, configurationRevision: 0, configurationUpdatedAt: 0, lastNow: 0, locks: [], tickets: [], skips: [] };
  const unlocked = new Map(),
    challenges = new Map(),
    verifying = new Set();
  if (fs.existsSync(file)) {
    data = storage.read(file);
    if (
      !data ||
      data.version !== 1 ||
      !finite(data.lastNow) ||
      !Array.isArray(data.locks) ||
      !Array.isArray(data.tickets) ||
      !Array.isArray(data.skips) ||
      data.skips.some((x) => !finite(x))
    )
      throw Error("Invalid experience policy storage");
    if (data.configurationRevision === undefined) data.configurationRevision = 0;
    if (data.configurationUpdatedAt === undefined) data.configurationUpdatedAt = 0;
    if (!finite(data.configurationUpdatedAt)) throw Error("Invalid configuration timestamp");
    if (!finite(data.configurationRevision)) throw Error("Invalid configuration revision");
    const targets = new Set();
    for (const l of data.locks) {
      if (
        !l ||
        !id(l.targetId) ||
        targets.has(l.targetId) ||
        !Object.hasOwn(policies, l.policy) ||
        !id(l.reference) ||
        !finite(l.remaining) ||
        l.remaining > attempts ||
        !finite(l.escalation) ||
        !finite(l.waitUntil) ||
        !finite(l.wrongDishes) ||
        !["dish", "sums", "moles", "clock"].includes(l.rung) ||
        !["surface", "minutes", "session"].includes(l.duration?.mode) ||
        !finite(l.duration.minutes)
      )
        throw Error("Invalid experience policy storage");
      targets.add(l.targetId);
    }
    for (const t of data.tickets)
      if (
        !t ||
        !id(t.id) ||
        !id(t.targetId) ||
        !id(t.category) ||
        typeof t.description !== "string" ||
        t.description.length > 4000 ||
        !["open", "responded", "resolved"].includes(t.status)
      )
        throw Error("Invalid support ticket storage");
  }
  let lastObserved = data.lastNow;
  const clock = () => {
    const value = now();
    if (!finite(value)) throw Error("Invalid clock");
    lastObserved = Math.max(value, data.lastNow, lastObserved);
    return lastObserved;
  };
  const write = (mutate) => {
    const next = clone(data);
    next.lastNow = clock();
    mutate(next);
    storage.atomic(file, next);
    data = next;
  };
  const find = (target, source = data) => {
    const lock = source.locks.find((x) => x.targetId === target);
    if (!lock) throw Error("Unknown experience policy");
    return lock;
  };
  const refresh = (target) => {
    const l = find(target);
    if (l.waitUntil && clock() >= l.waitUntil)
      write((d) => {
        const l = find(target, d);
        l.waitUntil = 0;
        l.remaining = attempts;
        l.wrongDishes = 0;
        l.rung = "dish";
      });
    return find(target);
  };
  const view = (l) => ({
    targetId: l.targetId,
    policy: l.policy,
    duration: l.duration,
    remaining: l.remaining,
    waitUntil: l.waitUntil,
    escalation: l.escalation,
    rung: l.rung,
    locked: !unlocked.has(l.targetId) || unlocked.get(l.targetId) <= clock(),
    unlockedUntil: unlocked.get(l.targetId) || 0,
    disclosure:
      "This is a reversible experience preference, not security or encryption.",
  });
  const skipAvailable = () =>
    data.skips.filter((t) => t > clock() - 3600000).length < 3;
  const clearWait = (target) => {
    if (!skipAvailable()) throw Error("Wait skip budget exhausted");
    write((d) => {
      const l = find(target, d);
      l.waitUntil = 0;
      l.remaining = attempts;
      d.skips = d.skips.filter((t) => t > d.lastNow - 3600000);
      d.skips.push(d.lastNow);
    });
  };
  return {
    policies: Object.keys(policies),
    configuration() {
      return { revision: data.configurationRevision, timestamp: data.configurationUpdatedAt, locks: data.locks.map(({targetId,policy,duration}) => ({targetId,policy,duration:clone(duration)})) };
    },
    async enroll({
      targetId,
      policy,
      credentials,
      confirmation,
      duration = { mode: "session", minutes: 0 },
      disclosureAccepted = false,
    }) {
      if (
        !id(targetId) ||
        !Object.hasOwn(policies, policy) ||
        !disclosureAccepted ||
        !["surface", "minutes", "session"].includes(duration.mode) ||
        !finite(duration.minutes) ||
        duration.minutes > 1440 ||
        (duration.mode === "minutes" && duration.minutes < 1)
      )
        throw Error("Invalid policy enrollment");
      if (!data.locks.some(lock => lock.targetId === targetId) && data.locks.length >= 500) throw Error("Lock limit reached");
      const stored = {};
      for (const factor of policies[policy]) {
        const value = credentials?.[factor];
        if (
          typeof value !== "string" ||
          value.length > 1024 ||
          value !== confirmation?.[factor]
        )
          throw Error("Enrollment confirmation mismatch");
        if (factor === "pin") {
          if (!/^\d{4,12}$/.test(value)) throw Error("Invalid PIN");
          stored.pin = hash(value);
        } else if (factor === "password") {
          if (value.length < 8) throw Error("Invalid password");
          stored.password = hash(value);
        } else {
          decodeBase32(value);
          if (!verifyTotp(value, credentials.code, { time: clock() }))
            throw Error("Pairing confirmation required");
          stored.totp = value;
        }
      }
      const reference = await vault.write(
        "experience:" + crypto.randomUUID(),
        stored,
      );
      if (!id(reference)) throw Error("Invalid vault reference");
      write((d) => {
        d.configurationRevision++;
        d.configurationUpdatedAt = d.lastNow;
        d.locks = d.locks.filter((x) => x.targetId !== targetId);
        d.locks.push({
          targetId,
          policy,
          reference,
          duration: clone(duration),
          remaining: attempts,
          waitUntil: 0,
          escalation: 0,
          wrongDishes: 0,
          rung: "dish",
        });
      });
      unlocked.delete(targetId);
      return view(find(targetId));
    },
    list() {
      return data.locks.map((l) => view(refresh(l.targetId)));
    },
    get(target) {
      return view(refresh(target));
    },
    isLocked(target) {
      if (!data.locks.some((l) => l.targetId === target)) return false;
      return view(refresh(target)).locked;
    },
    requireUnlocked(target) {
      if (this.isLocked(target)) throw Error("Experience policy is locked");
      return true;
    },
    relock(target) {
      find(target);
      unlocked.delete(target);
    },
    leaveSurface(target) {
      if (find(target).duration.mode === "surface") unlocked.delete(target);
    },
    remove(target) {
      find(target);
      write((d) => {
        d.configurationRevision++;
        d.configurationUpdatedAt = d.lastNow;
        d.locks = d.locks.filter((l) => l.targetId !== target);
      });
      unlocked.delete(target);
    },
    async unlock(target, credentials) {
      if (verifying.has(target))
        throw Error("Verification already in progress");
      verifying.add(target);
      try {
        const l = refresh(target);
        if (l.waitUntil > clock())
          return {
            unlocked: false,
            waiting: true,
            remaining: l.remaining,
            waitUntil: l.waitUntil,
          };
        const observed = l.reference;
        let valid = false;
        try {
          const stored = await vault.read(l.reference);
          valid = policies[l.policy].every((f) =>
            f === "totp"
              ? verifyTotp(stored.totp, credentials?.totp, { time: clock() })
              : matches(credentials?.[f], stored[f]),
          );
        } catch (e) {
          return { unlocked: false, unavailable: true };
        }
        if (find(target).reference !== observed)
          throw Error("Policy changed during verification");
        if (valid) {
          unlocked.set(
            target,
            l.duration.mode === "minutes"
              ? clock() + l.duration.minutes * 60000
              : Number.MAX_SAFE_INTEGER,
          );
          write((d) => {
            find(target, d).remaining = attempts;
            find(target, d).escalation = 0;
          });
          return { unlocked: true };
        }
        write((d) => {
          const current = find(target, d);
          current.remaining--;
          if (current.remaining <= 0) {
            current.escalation++;
            current.waitUntil =
              d.lastNow +
              Math.min(
                waitMs * 2 ** Math.min(current.escalation - 1, 20),
                3600000,
              );
            current.rung = "dish";
            current.wrongDishes = 0;
          }
        });
        return {
          unlocked: false,
          remaining: find(target).remaining,
          waitUntil: find(target).waitUntil,
        };
      } finally {
        verifying.delete(target);
      }
    },
    challenge(target, { schoolMode = false } = {}) {
      let l = refresh(target);
      if (!l.waitUntil || !skipAvailable() || l.rung === "clock")
        throw Error("Ladder unavailable");
      if (schoolMode && l.rung === "dish") {
        write((d) => {
          find(target, d).rung = "sums";
        });
        l = find(target);
      }
      for (const [key, challenge] of challenges) if (challenge.target === target || challenge.expires <= clock()) challenges.delete(key);
      if (challenges.size >= 256) throw Error("Too many active challenges");
      const nonce = crypto.randomUUID(),
        start = clock(),
        c = {
          target,
          reference: l.reference,
          waitUntil: l.waitUntil,
          rung: l.rung,
          start,
          expires: start + 60000,
        };
      let publicChallenge;
      if (l.rung === "dish") {
        const choices = ["Steamed bun", "Rice roll", "Spring roll", "Dumpling"];
        c.answer = crypto.randomInt(4);
        publicChallenge = {
          kind: "dish",
          question: "Choose the named dish.",
          dish: choices[c.answer],
          choices,
        };
      } else if (l.rung === "sums") {
        c.sums = Array.from({ length: 10 }, () => [
          crypto.randomInt(1, 30),
          crypto.randomInt(1, 30),
        ]);
        publicChallenge = {
          kind: "sums",
          sums: c.sums.map(([a, b]) => ({ a, b, operator: "+" })),
        };
      } else {
        c.duration = 10000;
        c.schedule = Array.from({ length: 10 }, (_, i) => ({
          cell: crypto.randomInt(9),
          from: i * 1000,
          to: i * 1000 + 800,
        }));
        c.hits = [];
        publicChallenge = {
          kind: "moles",
          durationMs: c.duration,
          schedule: c.schedule,
        };
      }
      challenges.set(nonce, c);
      return { nonce, expires: c.expires, ...publicChallenge };
    },
    hit(nonce, cell) {
      const c = challenges.get(nonce);
      if (!c || c.rung !== "moles" || clock() >= c.expires)
        throw Error("Invalid mole round");
      const elapsed = clock() - c.start,
        index = c.schedule.findIndex(
          (m) => m.cell === cell && elapsed >= m.from && elapsed < m.to,
        );
      if (index < 0 || c.hits.includes(index)) return false;
      c.hits.push(index);
      return true;
    },
    answer(nonce, answer) {
      const c = challenges.get(nonce);
      challenges.delete(nonce);
      if (!c || clock() >= c.expires)
        throw Error("Expired or consumed challenge");
      const l = refresh(c.target);
      if (
        l.reference !== c.reference ||
        l.waitUntil !== c.waitUntil ||
        l.rung !== c.rung ||
        !l.waitUntil
      )
        throw Error("Stale challenge");
      let correct = false;
      if (c.rung === "dish")
        correct = Number.isInteger(answer) && answer === c.answer;
      else if (c.rung === "sums")
        correct =
          Array.isArray(answer) &&
          answer.length === 10 &&
          c.sums.every(([a, b], i) => answer[i] === a + b);
      else {
        if (clock() - c.start < c.duration)
          throw Error("Round is still running");
        correct = c.hits.length >= 7;
      }
      if (correct) {
        clearWait(c.target);
        return { waitCleared: true, unlocked: false };
      }
      write((d) => {
        const l = find(c.target, d);
        if (c.rung === "dish") {
          l.wrongDishes++;
          if (l.wrongDishes >= 5) l.rung = "sums";
        } else l.rung = c.rung === "sums" ? "moles" : "clock";
      });
      return { waitCleared: false, unlocked: false, rung: find(c.target).rung };
    },
    createTicket({ targetId, category, description, severity = "normal" }) {
      if (
        !id(targetId) ||
        !id(category) ||
        typeof description !== "string" ||
        !description.trim() ||
        description.length > 4000 ||
        !["low", "normal", "high"].includes(severity)
      )
        throw Error("Invalid support ticket");
      const ticket = {
        id: crypto.randomUUID(),
        targetId,
        category,
        description,
        severity,
        status: "open",
        createdAt: clock(),
      };
      if (data.tickets.length >= 500) throw Error("Ticket limit reached");
      write((d) => d.tickets.push(ticket));
      return clone(ticket);
    },
    deleteTickets(ids) {
      if (!Array.isArray(ids) || ids.length > 500 || ids.some(x => !id(x))) throw Error("Invalid ticket selection");
      write(d => { d.tickets = d.tickets.filter(t => !ids.includes(t.id)); });
    },
    tickets() {
      return clone(data.tickets);
    },
    advanceTicket(ticketId) {
      const current = data.tickets.find((t) => t.id === ticketId);
      if (!current) throw Error("Unknown ticket");
      write((d) => {
        const t = d.tickets.find((t) => t.id === ticketId);
        t.status = t.status === "open" ? "responded" : "resolved";
        t.response =
          "This local ticket is automated. Recovery consists of opening the application data folder; deletion is your own action.";
      });
      return clone(data.tickets.find((t) => t.id === ticketId));
    },
    recovery() {
      return {
        directory,
        disclosure:
          "Nothing is sent anywhere. No ticket exists outside this machine. No network request is made. No data is collected and nobody is reading it.",
      };
    },
    async openRecoveryFolder() {
      if (typeof openFolder !== "function")
        throw Error("File manager unavailable");
      const result = await openFolder(directory);
      if (result !== undefined && result !== "")
        throw Error("File manager could not open the folder");
      return { opened: true, directory };
    },
  };
}
module.exports = { createExperiencePolicyService };
