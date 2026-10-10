var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.js
var index_exports = {};
__export(index_exports, {
  Charon: () => Charon,
  LockGate: () => LockGate,
  LockLimited: () => LockLimited,
  LockUnlimited: () => LockUnlimited,
  SerialQueue: () => SerialQueue,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// src/queue/SerialQueue.js
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

// src/tools.js
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

// src/locks/LockGate.js
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

// src/locks/LockUnlimited.js
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

// src/contexts/TxContextBounced.js
var import_bounce2 = require("@randajan/bounce");

// src/contexts/TxContext.js
var import_bounce = require("@randajan/bounce");
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
      this.#fctid = (0, import_bounce.setTimeoutUnref)(onForceClose, forceCloseMs, unref);
    }
  }
  clear() {
    clearTimeout(this.#fctid);
    this.#opt.onClear?.(this);
  }
};

// src/contexts/TxContextBounced.js
var TxContextBounced = class extends TxContext {
  #bounce;
  touch(type, ms) {
    if (this.signal.aborted) {
      return false;
    }
    if (!this.#bounce) {
      const { totalMs, unref } = this.opt;
      this.#bounce = new import_bounce2.Bounce(this.abort.bind(this), {
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

// src/contexts/TxContextSimple.js
var import_bounce3 = require("@randajan/bounce");
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
      this.#tid = (0, import_bounce3.setTimeoutUnref)((_) => this.abort(this.#log, abortTrigger), ms, unref);
    }
    this.#log.push(type);
    return true;
  }
  clear() {
    super.clear();
    clearTimeout(this.#tid);
  }
};

// src/locks/LockLimited.js
var import_bounce4 = require("@randajan/bounce");
var LockLimited = class extends LockUnlimited {
  #clearTx;
  #tx;
  constructor(cfg = {}) {
    super({
      ...cfg,
      totalMs: (0, import_bounce4.validateTimeout)(cfg.totalMs, "Lock cfg.totalMs"),
      opMs: (0, import_bounce4.validateTimeout)(cfg.opMs, "Lock cfg.opMs"),
      idleMs: (0, import_bounce4.validateTimeout)(cfg.idleMs, "Lock cfg.idleMs"),
      forceCloseMs: (0, import_bounce4.validateTimeout)(cfg.forceCloseMs, "Lock cfg.forceCloseMs"),
      unref: !!cfg.unref
    });
    this.#clearTx = (tx) => {
      if (this.#tx === tx) {
        this.#tx = void 0;
      }
    };
  }
  getOptMs(msName, opt, txOptFallback = false) {
    const ms = (0, import_bounce4.validateTimeout)(opt?.[msName], `Lock opt.${msName}`);
    if (ms !== null) {
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

// src/collection/Charon.js
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
      if (hasNext && this.#locks.get(id) === lock2) {
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

// src/index.js
var index_default = Charon;
//# sourceMappingURL=index.cjs.map
