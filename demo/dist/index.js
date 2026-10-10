// demo/src/index.js
import assert from "assert/strict";

// dist/esm/index.mjs
import { Bounce } from "@randajan/bounce";
import { setTimeoutUnref } from "@randajan/bounce";
import { setTimeoutUnref as setTimeoutUnref2 } from "@randajan/bounce";
import { validateTimeout } from "@randajan/bounce";
var SerialQueue = class {
  #tail = Promise.resolve();
  #size = 0;
  get size() {
    return this.#size;
  }
  get idle() {
    return this.#size === 0;
  }
  add(callback) {
    this.#size++;
    const task = this.#tail.then(callback).finally(() => {
      this.#size--;
    });
    this.#tail = task.then(() => void 0, () => void 0);
    return task;
  }
  drain() {
    return this.#tail;
  }
};
var validObj = (obj, require2 = false, label = "") => {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj;
  }
  if (obj == null && !require2) {
    return;
  }
  throw TypeError(`${label} must be type of object`);
};
var validFn = (fn, require2 = false, label = "") => {
  if (typeof fn === "function") {
    return fn;
  }
  if (fn == null && !require2) {
    return;
  }
  throw TypeError(`${label} must be type of function`);
};
var LockGate = class {
  #cfg;
  #state = false;
  #currentKey;
  #queue = [];
  #generateKey;
  #onClose;
  constructor(cfg = {}) {
    const { generateKey, onClose, ...passCfg } = validObj(cfg, true, "Lock cfg");
    this.#generateKey = validFn(generateKey, true, "cfg.generateKey");
    this.#onClose = validFn(onClose, false, "cfg.onClose");
    passCfg.throwError = !!passCfg.throwError;
    this.#cfg = Object.freeze(passCfg);
  }
  get cfg() {
    return this.#cfg;
  }
  get size() {
    return this.#queue.length;
  }
  get state() {
    return this.#state;
  }
  getOptThrowError(opt) {
    return opt?.throwError != null ? !!opt.throwError : this.cfg.throwError;
  }
  #setKey(state) {
    this.#state = state = !!state;
    return this.#currentKey = state ? this.#generateKey() : void 0;
  }
  checkTx(key, opt) {
    if (key === this.#currentKey) {
      return true;
    }
    if (!this.getOptThrowError(opt)) {
      return false;
    }
    throw new Error(`Lock '${key}' is unknown`);
  }
  async openTx(opt) {
    if (!this.#state) {
      return this.#setKey(true);
    }
    return new Promise((resolve) => {
      this.#queue.push(resolve);
    });
  }
  closeTx(key, opt) {
    if (!this.checkTx(key, opt)) {
      return false;
    }
    const next = this.#queue.shift();
    const hasNext = !!next;
    const newKey = this.#setKey(hasNext);
    if (hasNext) {
      next(newKey);
    }
    this.#onClose?.(this, hasNext);
    return true;
  }
};
var LockUnlimited = class _LockUnlimited extends LockGate {
  static optWithoutThrowError(opt) {
    if (!opt) {
      return;
    }
    const { throwError, ...passOpt } = opt;
    return passOpt;
  }
  #ops = new SerialQueue();
  #closing = false;
  get state() {
    if (!super.state) {
      return "ready";
    }
    return this.#ops.idle ? "idle" : "busy";
  }
  isState(state) {
    return this.state === state;
  }
  async openTx(opt) {
    const key = await super.openTx(opt);
    this.#closing = false;
    return key;
  }
  async closeTx(key, opt) {
    if (!this.checkTx(key, opt)) {
      return false;
    }
    this.#closing = true;
    await this.#ops.drain();
    return super.closeTx(key, opt);
  }
  async runInTx(key, op, opt) {
    if (!this.checkTx(key, opt)) {
      return false;
    }
    if (this.#closing) {
      if (!this.getOptThrowError(opt)) {
        return false;
      }
      throw new Error(`Lock '${key}' is closing`);
    }
    return this.#ops.add(op);
  }
  async run(op, opt) {
    const key = await this.openTx(opt);
    try {
      return await this.runInTx(key, op, opt);
    } finally {
      await this.closeTx(key, _LockUnlimited.optWithoutThrowError(opt));
    }
  }
  async runTx(tx, opt) {
    const key = await this.openTx(opt);
    const run = (op, opt2) => this.runInTx(key, op, opt2);
    try {
      return await tx(run);
    } finally {
      await this.closeTx(key, _LockUnlimited.optWithoutThrowError(opt));
    }
  }
};
var TxContext = class extends AbortController {
  #opt;
  #fctid;
  constructor(opt = {}) {
    super();
    this.#opt = Object.freeze(opt);
  }
  get opt() {
    return this.#opt;
  }
  get key() {
    return this.#opt.key;
  }
  touch() {
    return false;
  }
  abort(log, trigger) {
    if (!this.signal.aborted) {
      super.abort({ log, trigger });
    }
    const { forceCloseMs, onForceClose, unref } = this.#opt;
    if (forceCloseMs > 0 && this.#fctid == null) {
      this.#fctid = setTimeoutUnref(onForceClose, forceCloseMs, unref);
    }
  }
  clear() {
    clearTimeout(this.#fctid);
    this.#opt.onClear?.(this);
  }
};
var TxContextBounced = class extends TxContext {
  #bounce;
  touch(type, ms) {
    if (this.signal.aborted) {
      return false;
    }
    if (!this.#bounce) {
      const { totalMs, unref } = this.opt;
      this.#bounce = new Bounce(this.abort.bind(this), {
        hardMs: totalMs,
        unref
      });
    }
    this.#bounce.attach(type, ms);
    return true;
  }
  clear() {
    super.clear();
    this.#bounce.flush();
  }
};
var TxContextSimple = class extends TxContext {
  #tid;
  #log = [];
  touch(type) {
    const { totalMs, opMs, unref } = this.opt;
    const abortIsHard = totalMs > 0 && (!(opMs > 0) || totalMs <= opMs);
    const abortTrigger = abortIsHard ? "hard" : "soft";
    const ms = abortIsHard ? totalMs : opMs;
    if (ms > 0 && type === "op") {
      clearTimeout(this.#tid);
      this.#tid = setTimeoutUnref2((_) => this.abort(this.#log, abortTrigger), ms, unref);
    }
    this.#log.push(type);
    return true;
  }
  clear() {
    super.clear();
    clearTimeout(this.#tid);
  }
};
var LockLimited = class extends LockUnlimited {
  #clearTx;
  #tx;
  constructor(cfg = {}) {
    super({
      ...cfg,
      totalMs: validateTimeout(cfg.totalMs, "Lock cfg.totalMs"),
      opMs: validateTimeout(cfg.opMs, "Lock cfg.opMs"),
      idleMs: validateTimeout(cfg.idleMs, "Lock cfg.idleMs"),
      forceCloseMs: validateTimeout(cfg.forceCloseMs, "Lock cfg.forceCloseMs"),
      unref: !!cfg.unref
    });
    this.#clearTx = (tx) => {
      if (this.#tx === tx) {
        this.#tx = void 0;
      }
    };
  }
  getOptMs(msName, opt, txOptFallback = false) {
    const ms = validateTimeout(opt?.[msName], `Lock opt.${msName}`);
    if (ms != null) {
      return ms;
    }
    const txMs = txOptFallback ? this.#tx?.opt[msName] : void 0;
    return txMs ?? this.cfg[msName];
  }
  checkTx(key, opt = {}) {
    if (!super.checkTx(key, opt)) {
      return false;
    }
    if (this.#tx?.key === key) {
      return true;
    }
    if (!this.getOptThrowError(opt)) {
      return false;
    }
    throw new Error(`Lock '${key}' unstable state reached.`);
  }
  #touchTx(key, type, ms, opt = {}) {
    if (!this.checkTx(key, opt)) {
      return false;
    }
    if (this.#tx.touch(type, ms)) {
      return true;
    }
    if (!this.getOptThrowError(opt)) {
      return false;
    }
    throw new Error(`Lock '${key}' expired`);
  }
  async #openTx(TxContextClass, opt = {}) {
    const { unref } = this.cfg;
    const totalMs = this.getOptMs("totalMs", opt);
    const opMs = this.getOptMs("opMs", opt);
    const idleMs = this.getOptMs("idleMs", opt);
    const forceCloseMs = this.getOptMs("forceCloseMs", opt);
    const key = await super.openTx(opt);
    const noThrowOpt = LockUnlimited.optWithoutThrowError(opt);
    const tx = this.#tx = new TxContextClass({
      key,
      totalMs,
      idleMs,
      opMs,
      forceCloseMs,
      unref,
      onForceClose: (_) => this.closeTx(key, noThrowOpt),
      onClear: this.#clearTx
    });
    return tx;
  }
  async openTx(opt) {
    const tx = await this.#openTx(TxContextBounced, opt);
    const { key, signal, opt: { idleMs } } = tx;
    tx.touch("idle", idleMs);
    return { key, signal };
  }
  async closeTx(key, opt) {
    const tx = this.#tx;
    const closed = await super.closeTx(key, opt);
    if (closed) {
      tx?.clear();
    }
    return closed;
  }
  touchTx(key, opt) {
    if (!this.isState("idle")) {
      if (!this.getOptThrowError(opt)) {
        return false;
      }
      throw new Error(`Lock '${key}' is not idle`);
    }
    const idleMs = this.getOptMs("idleMs", opt, true);
    return this.#touchTx(key, "touch", idleMs, opt);
  }
  async run(op, opt) {
    const tx = await this.#openTx(TxContextSimple, opt);
    const { key, signal } = tx;
    try {
      return await super.runInTx(key, () => {
        tx.touch("op");
        return op(signal);
      }, opt);
    } finally {
      await this.closeTx(key, LockUnlimited.optWithoutThrowError(opt));
    }
  }
  async runInTx(key, op, opt) {
    const opMs = this.getOptMs("opMs", opt, true);
    const idleMs = this.getOptMs("idleMs", opt, true);
    return super.runInTx(key, async () => {
      if (!this.#touchTx(key, "op", opMs, opt)) {
        return false;
      }
      try {
        return await op(this.#tx.signal);
      } finally {
        this.#touchTx(key, "idle", idleMs, LockUnlimited.optWithoutThrowError(opt));
      }
    }, opt);
  }
  async runTx(tx, opt) {
    const { key, signal } = await this.openTx(opt);
    const run = (op, opt2) => this.runInTx(key, op, opt2);
    try {
      return await tx(run, signal);
    } finally {
      await this.closeTx(key, LockUnlimited.optWithoutThrowError(opt));
    }
  }
};
var Charon = class {
  #locks = /* @__PURE__ */ new Map();
  #cfg;
  constructor(cfg = {}) {
    this.#cfg = validObj(cfg, false, "Charon cfg");
  }
  get size() {
    return this.#locks.size;
  }
  #create(id) {
    let lock;
    const onClose = (lock2, hasNext) => {
      if (!hasNext && this.#locks.get(id) === lock2) {
        this.#locks.delete(id);
      }
      this.#cfg.onClose?.(this, { lock: lock2, id, hasNext });
    };
    lock = new LockLimited({ ...this.#cfg, onClose });
    this.#locks.set(id, lock);
    return lock;
  }
  #getOrAdd(id) {
    return this.#locks.get(id) ?? this.#create(id);
  }
  get(id, opt = {}) {
    const lock = this.#locks.get(id);
    if (lock) {
      return lock;
    }
    if (!opt?.throwError) {
      return;
    }
    throw new Error(`Lock '${id}' does not exist`);
  }
  has(id, opt = {}) {
    return !!this.get(id, opt);
  }
  async run(id, callback, opt) {
    return this.#getOrAdd(id).run(callback, opt);
  }
  openTx(id, opt) {
    return this.#getOrAdd(id).openTx(opt);
  }
  checkTx(id, key, opt = {}) {
    const lock = this.get(id, opt);
    return lock ? lock.checkTx(key, opt) : false;
  }
  touchTx(id, key, opt = {}) {
    const lock = this.get(id, opt);
    return lock ? lock.touchTx(key, opt) : false;
  }
  async runInTx(id, key, callback, opt = {}) {
    const lock = this.get(id, opt);
    return lock ? lock.runInTx(key, callback, opt) : false;
  }
  closeTx(id, key, opt = {}) {
    const lock = this.get(id, opt);
    return lock ? lock.closeTx(key, opt) : false;
  }
  async runTx(id, tx, opt = {}) {
    return this.#getOrAdd(id).runTx(tx, opt);
  }
};
var index_default = Charon;

// demo/src/index.js
var wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var waitForAbort = (signal, timeoutMs = 200) => new Promise((resolve, reject) => {
  if (signal.aborted) {
    return resolve(signal.reason);
  }
  const timeout = setTimeout(() => {
    reject(new Error("LockLimited did not abort the transaction in time"));
  }, timeoutMs);
  signal.addEventListener("abort", () => {
    clearTimeout(timeout);
    resolve(signal.reason);
  }, { once: true });
});
var waitUntil = async (predicate, timeoutMs = 200) => {
  const expiresAt = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= expiresAt) {
      throw new Error("Condition was not met in time");
    }
    await wait(5);
  }
};
var createKeyGenerator = (prefix = "tx") => {
  let id = 0;
  return () => `${prefix}-${++id}`;
};
var runDemo = async (label, callback) => {
  process.stdout.write(`
${label}
`);
  await callback();
  console.log("  \u2713 all checks passed");
};
await runDemo("1. SerialQueue runs asynchronous work in order", async () => {
  const queue = new SerialQueue();
  const events = [];
  const first = queue.add(async () => {
    events.push("first:start");
    await wait(20);
    events.push("first:end");
    return 1;
  });
  const second = queue.add(async () => {
    events.push("second:start");
    await wait(5);
    events.push("second:end");
    return 2;
  });
  assert.equal(queue.size, 2);
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "second:start",
    "second:end"
  ]);
  const failed = queue.add(() => {
    throw new Error("expected demo error");
  });
  const afterFailure = queue.add(() => 3);
  await assert.rejects(failed, /expected demo error/);
  assert.equal(await afterFailure, 3, "a failed task must not block the queue");
  await queue.drain();
  assert.equal(queue.idle, true);
});
await runDemo("2. LockGate hands ownership to the next transaction", async () => {
  const lock = new LockGate({ generateKey: createKeyGenerator("gate") });
  const firstKey = await lock.openTx();
  const secondKeyPromise = lock.openTx();
  assert.equal(firstKey, "gate-1");
  assert.equal(lock.state, true);
  assert.equal(lock.size, 1, "the second transaction should be waiting");
  assert.equal(lock.closeTx("unknown"), false);
  assert.throws(
    () => lock.closeTx("unknown", { throwError: true }),
    /unknown/
  );
  assert.equal(lock.closeTx(firstKey), true);
  const secondKey = await secondKeyPromise;
  assert.equal(secondKey, "gate-2");
  assert.equal(lock.size, 0);
  assert.equal(lock.closeTx(secondKey), true);
  assert.equal(lock.state, false);
});
await runDemo("3. LockUnlimited serializes complete transactions", async () => {
  const lock = new LockUnlimited({ generateKey: createKeyGenerator("unlimited") });
  const events = [];
  const first = lock.run(async () => {
    events.push("first:start");
    await wait(20);
    events.push("first:end");
    return "first result";
  });
  const second = lock.run(async () => {
    events.push("second:start");
    await wait(5);
    events.push("second:end");
    return "second result";
  });
  assert.deepEqual(await Promise.all([first, second]), [
    "first result",
    "second result"
  ]);
  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "second:start",
    "second:end"
  ]);
  assert.equal(lock.state, "ready");
});
await runDemo("4. LockLimited aborts an operation after its timeout", async () => {
  const lock = new LockLimited({
    generateKey: createKeyGenerator("limited"),
    opMs: 20,
    unref: false
  });
  const reason = await lock.run((signal) => waitForAbort(signal));
  assert.equal(reason.trigger, "soft");
  assert.deepEqual(reason.log, ["op"]);
  assert.equal(lock.state, "ready");
});
await runDemo("5. Charon serializes each id independently", async () => {
  assert.equal(index_default, Charon, "default and named exports should match");
  const closed = [];
  const locks = new index_default({
    generateKey: createKeyGenerator("charon"),
    onClose: (_charon, event) => closed.push({
      id: event.id,
      hasNext: event.hasNext
    })
  });
  const events = [];
  const accountA1 = locks.run("account-a", async () => {
    events.push("a1:start");
    await wait(25);
    events.push("a1:end");
    return "a1";
  });
  const accountA2 = locks.run("account-a", async () => {
    events.push("a2:start");
    await wait(5);
    events.push("a2:end");
    return "a2";
  });
  const accountB = locks.run("account-b", async () => {
    events.push("b:start");
    await wait(5);
    events.push("b:end");
    return "b";
  });
  assert.deepEqual(await Promise.all([accountA1, accountA2, accountB]), [
    "a1",
    "a2",
    "b"
  ]);
  assert.ok(
    events.indexOf("a2:start") > events.indexOf("a1:end"),
    "operations using the same id must be serialized"
  );
  assert.ok(
    events.indexOf("b:end") < events.indexOf("a1:end"),
    "operations using different ids should run independently"
  );
  assert.equal(locks.size, 0, "finished locks should be removed from Charon");
  assert.ok(closed.some((event) => event.id === "account-a"));
  assert.ok(closed.some((event) => event.id === "account-b"));
});
await runDemo("6. Explicit transaction serializes its operations", async () => {
  const lock = new LockLimited({
    generateKey: createKeyGenerator("explicit")
  });
  const { key, signal } = await lock.openTx();
  const events = [];
  const first = lock.runInTx(key, async (operationSignal) => {
    assert.equal(operationSignal, signal);
    events.push("first:start");
    await wait(20);
    events.push("first:end");
    return 1;
  });
  const second = lock.runInTx(key, async () => {
    events.push("second:start");
    events.push("second:end");
    return 2;
  });
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "second:start",
    "second:end"
  ]);
  assert.equal(await lock.closeTx(key), true);
  assert.equal(lock.state, "ready");
});
await runDemo("7. Idle transaction is aborted after idleMs", async () => {
  const lock = new LockLimited({
    generateKey: createKeyGenerator("idle"),
    idleMs: 20,
    unref: false
  });
  const { key, signal } = await lock.openTx();
  const reason = await waitForAbort(signal);
  assert.equal(reason.trigger, "soft");
  assert.deepEqual(reason.log, ["idle"]);
  assert.equal(await lock.closeTx(key), true);
});
await runDemo("8. totalMs remains a hard deadline after touches", async () => {
  const lock = new LockLimited({
    generateKey: createKeyGenerator("total"),
    totalMs: 50,
    idleMs: 25,
    unref: false
  });
  const { key, signal } = await lock.openTx();
  await wait(15);
  assert.equal(lock.touchTx(key), true);
  await wait(15);
  assert.equal(lock.touchTx(key), true);
  await wait(15);
  assert.equal(lock.touchTx(key), true);
  const reason = await waitForAbort(signal);
  assert.equal(reason.trigger, "hard");
  assert.deepEqual(reason.log, ["idle", "touch", "touch", "touch"]);
  assert.equal(await lock.closeTx(key), true);
});
await runDemo("9. forceCloseMs releases an abandoned transaction", async () => {
  const closed = [];
  const lock = new LockLimited({
    generateKey: createKeyGenerator("forced"),
    idleMs: 15,
    forceCloseMs: 15,
    unref: false,
    onClose: (_lock, hasNext) => closed.push(hasNext)
  });
  const { key, signal } = await lock.openTx();
  await waitForAbort(signal);
  await waitUntil(() => lock.state === "ready");
  assert.equal(lock.checkTx(key), false);
  assert.deepEqual(closed, [false]);
});
await runDemo("10. A rejected operation still releases the lock", async () => {
  const lock = new LockLimited({
    generateKey: createKeyGenerator("error")
  });
  await assert.rejects(
    lock.run(async () => {
      throw new Error("operation failed");
    }),
    /operation failed/
  );
  assert.equal(lock.state, "ready");
  assert.equal(await lock.run(async () => "recovered"), "recovered");
  assert.equal(lock.state, "ready");
});
console.log("\nCharon demo completed successfully.");
//# sourceMappingURL=index.js.map
