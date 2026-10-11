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
  CharonError: () => CharonError,
  Lock: () => Lock,
  Observer: () => Observer,
  PendingAbortError: () => PendingAbortError,
  PromiseQueue: () => PromiseQueue,
  TxAbortError: () => TxAbortError,
  TxError: () => TxError,
  TxTimeoutError: () => TxTimeoutError,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// src/base/errors.js
var TIMEOUT_MESSAGES = {
  total: "Transaction exceeded totalMs",
  op: "Operation exceeded opMs",
  idle: "Transaction exceeded idleMs"
};
var CharonError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
};
var TxError = class extends CharonError {
  constructor(code, message, log = []) {
    super(code, message);
    this.log = Object.freeze([...log]);
  }
};
var TxTimeoutError = class extends TxError {
  constructor(limit, ms, log) {
    const message = TIMEOUT_MESSAGES[limit] ?? `Transaction exceeded '${limit}' time limit`;
    super(limit, `${message} (${ms} ms)`, log);
    this.ms = ms;
  }
};
var TxAbortError = class extends TxError {
  constructor(log) {
    super("manual", "Transaction was interrupted", log);
  }
};
var PendingAbortError = class extends CharonError {
  constructor(code) {
    super(code, `Pending ${code} were aborted`);
  }
};

// src/base/queue/PromiseQueue.js
var PromiseQueue = class {
  #queue = [];
  #running = false;
  #drain = [];
  get size() {
    return this.#queue.length + (this.#running ? 1 : 0);
  }
  get state() {
    return this.#running ? "busy" : "idle";
  }
  isState(state) {
    return this.state === state;
  }
  run(callback) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ callback, resolve, reject });
      this.#next();
    });
  }
  abort(reason) {
    reason ??= new PendingAbortError("operations");
    const queue = this.#queue.splice(0);
    for (const { reject } of queue) {
      reject(reason);
    }
    this.#resolveDrain();
    return queue.length;
  }
  drain() {
    if (!this.size) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.#drain.push(resolve));
  }
  #next() {
    if (this.#running) {
      return;
    }
    const task = this.#queue.shift();
    if (!task) {
      return this.#resolveDrain();
    }
    this.#running = true;
    Promise.resolve().then(task.callback).then(task.resolve, task.reject).finally(() => {
      this.#running = false;
      this.#next();
    });
  }
  #resolveDrain() {
    if (this.size) {
      return;
    }
    for (const resolve of this.#drain.splice(0)) {
      resolve();
    }
  }
};

// src/base/transactions/TxPublic.js
var TxPublic = class {
  #tx;
  constructor(txContext) {
    this.#tx = txContext;
  }
  get state() {
    return this.#tx.state;
  }
  isState(state) {
    return this.#tx.isState(state);
  }
  get lock() {
    return this.#tx.lock;
  }
  get key() {
    return this.#tx.key;
  }
  get size() {
    return this.#tx.size;
  }
  get signal() {
    return this.#tx.signal;
  }
  run(op, opt) {
    return this.#tx.run(op, opt);
  }
  touch(opt) {
    return this.#tx.touch(opt);
  }
  abort(reason, opt) {
    return this.#tx.abort(reason, opt);
  }
  close(opt) {
    return this.#tx.close(opt);
  }
  kill(opt) {
    return this.#tx.kill(opt);
  }
};

// src/base/transactions/TxPrivate.js
var TxPrivate = class extends PromiseQueue {
  #cfg;
  #ac = new AbortController();
  #state = "pending";
  constructor(lock, key, observer, opt, onDestroy = (() => {
  })) {
    super();
    opt ??= {};
    const throwError = opt.throwError;
    const txPublic = new TxPublic(this);
    this.#cfg = { lock, key, throwError, public: txPublic, observer, onDestroy };
    const ctx = this.#cfg.ctx = observer?.createTxCtx(txPublic, opt);
    try {
      observer?.onCreate(txPublic, ctx);
    } catch {
    }
  }
  get public() {
    return this.#cfg.public;
  }
  get lock() {
    return this.#cfg.lock;
  }
  get key() {
    return this.#cfg.key;
  }
  get signal() {
    return this.#ac.signal;
  }
  get state() {
    return this.#state ?? super.state;
  }
  isState(state) {
    return this.state === state;
  }
  formatThrowError(opt) {
    return this.lock.formatThrowError(opt?.throwError ?? this.#cfg.throwError);
  }
  check(condition, message, opt) {
    if (condition) {
      return true;
    }
    if (!this.formatThrowError(opt)) {
      return false;
    }
    throw new Error(`Transaction '${this.key}' ${message}`);
  }
  mustIdle(opt) {
    return this.check(this.isState("idle"), "is not idling", opt);
  }
  mustAborted(opt) {
    return this.check(this.signal.aborted, "was not aborted", opt);
  }
  mustClosing(opt) {
    return this.check(this.isState("closing"), "is not closing", opt);
  }
  notAborted(opt) {
    return this.check(!this.isState("aborted"), "was aborted", opt);
  }
  notClosing(opt) {
    return this.check(!this.isState("closing"), "is closing", opt);
  }
  notDestroyed(opt) {
    return this.check(!this.isState("destroyed"), "was destroyed", opt);
  }
  open() {
    if (this.#state !== "pending") {
      return this.public;
    }
    const { observer, public: txPublic, ctx } = this.#cfg;
    this.#state = null;
    try {
      observer?.onOpen(txPublic, ctx);
    } catch {
    }
    return txPublic;
  }
  touch(opt) {
    if (!this.mustIdle(opt)) {
      return false;
    }
    const { observer, public: txPublic, ctx } = this.#cfg;
    try {
      observer?.onTouch(txPublic, ctx, opt);
    } catch {
    }
    return true;
  }
  async run(op, opt) {
    const { observer, public: txPublic, ctx } = this.#cfg;
    if (!this.notDestroyed(opt) || !this.notClosing(opt) || !this.notAborted(opt)) {
      return false;
    }
    const opCtx = observer?.createOpCtx(txPublic, ctx, opt);
    try {
      observer?.onAddOp(txPublic, opCtx);
    } catch {
    }
    try {
      return await super.run((_) => {
        try {
          observer?.onStartOp(txPublic, opCtx);
        } catch {
        }
        return op(txPublic);
      });
    } finally {
      try {
        observer?.onEndOp(txPublic, opCtx);
      } catch {
      }
    }
  }
  abort(reason, opt) {
    if (!this.notDestroyed(opt) || !this.notAborted(opt)) {
      return false;
    }
    const { observer, public: txPublic, ctx } = this.#cfg;
    reason = reason ?? new TxAbortError();
    this.#ac.abort(reason);
    super.abort(reason);
    this.#state = "aborted";
    try {
      observer?.onAbort(txPublic, ctx, opt);
    } catch {
    }
    return true;
  }
  async close(opt) {
    if (!this.notDestroyed(opt) || !this.notClosing(opt)) {
      return false;
    }
    const { observer, public: txPublic, ctx } = this.#cfg;
    try {
      observer?.onClosing(txPublic, ctx, opt);
    } catch {
    }
    this.#state = "closing";
    await super.drain();
    this.destroy();
    return true;
  }
  destroy() {
    if (this.#state === "destroyed") {
      return false;
    }
    const { observer, public: txPublic, ctx, onDestroy } = this.#cfg;
    this.#state = "destroyed";
    try {
      onDestroy(this);
    } catch {
    }
    try {
      observer?.onDestroy(txPublic, ctx);
    } catch {
    }
    return true;
  }
  kill(opt) {
    if (!this.mustAborted(opt) || !this.mustClosing(opt)) {
      return false;
    }
    return this.destroy();
  }
};

// src/base/observers/Observer.js
var Observer = class {
  #opt;
  constructor(opt = {}) {
    this.#opt = Object.freeze({ ...opt });
  }
  get opt() {
    return this.#opt;
  }
  createTxCtx(tx, opt) {
    return opt;
  }
  createOpCtx(tx, ctx, opt) {
    return { ctx, opt };
  }
  onCreate(tx, ctx) {
  }
  onOpen(tx, ctx) {
  }
  onTouch(tx, ctx, opt) {
  }
  onAddOp(tx, opCtx) {
  }
  onStartOp(tx, opCtx) {
  }
  onEndOp(tx, opCtx) {
  }
  onAbort(tx, ctx, opt) {
  }
  onClosing(tx, ctx, opt) {
  }
  onDestroy(tx, ctx) {
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

// src/base/collections/Lock.js
var Lock = class {
  #cfg;
  #queue = [];
  #tx;
  constructor(cfg = {}) {
    cfg = validObj(cfg, true, "Lock cfg");
    const { generateKey, onOpen, onClose, observer, throwError } = cfg;
    this.#cfg = {
      throwError: !!throwError,
      observer,
      generateKey: validFn(generateKey, true, "Lock cfg.generateKey"),
      onOpen: validFn(onOpen, false, "Lock cfg.onOpen") ?? (() => {
      }),
      onClose: validFn(onClose, false, "Lock cfg.onClose") ?? (() => {
      }),
      onDestroyTx: this.#detachTx.bind(this)
    };
  }
  get size() {
    return this.#queue.length;
  }
  get state() {
    return !this.#tx ? "ready" : this.#tx.state;
  }
  isState(state) {
    return this.state === state;
  }
  formatThrowError(throwError = void 0) {
    return throwError != null ? !!throwError : this.#cfg.throwError;
  }
  #createTx(opt) {
    const { generateKey, onDestroyTx, observer } = this.#cfg;
    const key = generateKey();
    if (key == null) {
      throw new TypeError(`Lock cfg.generateKey returned null or undefined`);
    }
    return new TxPrivate(this, key, observer, opt, onDestroyTx);
  }
  #attachTx(tx) {
    return (this.#tx = tx).open();
  }
  #detachTx(tx, opt) {
    if (this.#tx !== tx) {
      return;
    }
    this.#tx = void 0;
    const next = this.#queue.shift();
    const hasNext = !!next;
    if (hasNext) {
      next.resolve(this.#attachTx(next.tx));
    }
    try {
      this.#cfg.onClose(this, hasNext);
    } catch {
    }
  }
  getTx(key, throwError = void 0) {
    if (key === this.#tx?.key) {
      return this.#tx.public;
    }
    if (!this.formatThrowError(throwError)) {
      return;
    }
    throw new Error(`Transaction '${key}' not found`);
  }
  async openTx(opt) {
    try {
      this.#cfg.onOpen(this);
    } catch {
    }
    const tx = this.#createTx(opt);
    if (!this.#tx) {
      return this.#attachTx(tx);
    }
    return new Promise((resolve, reject) => this.#queue.push({ resolve, reject, tx }));
  }
  abortAll(reason, opt) {
    reason ??= new PendingAbortError("transactions");
    this.#tx?.abort(reason, opt);
    const queue = this.#queue.splice(0);
    for (const { reject, tx } of queue) {
      tx.destroy();
      reject(reason);
    }
    return queue.length;
  }
  async run(op, opt) {
    const txPublic = await this.openTx({ ...opt || {}, singleOp: true });
    try {
      return await txPublic.run(op, opt);
    } finally {
      await txPublic.close(opt);
    }
  }
  async runTx(tx, opt) {
    const txPublic = await this.openTx(opt);
    try {
      return await tx(txPublic);
    } finally {
      await txPublic.close(opt);
    }
  }
};

// src/base/collections/Charon.js
var import_bounce = require("@randajan/bounce");
var Charon = class {
  #locks = /* @__PURE__ */ new Map();
  #cfg = {};
  constructor(cfg = {}) {
    const cfgAll = validObj(cfg, false, "Charon cfg");
    const { onOpen, onClose, retainMs, ...lockCfg } = cfgAll;
    this.#cfg.lockCfg = lockCfg;
    this.#cfg.retainMs = (0, import_bounce.validateTimeout)(retainMs, "Charon cfg.retainMs") ?? 6e4;
    this.#cfg.onOpen = validFn(onOpen, false, "Charon cfg.onOpen") ?? (() => {
    });
    this.#cfg.onClose = validFn(onClose, false, "Charon cfg.onClose") ?? (() => {
    });
  }
  get size() {
    return this.#locks.size;
  }
  keys() {
    return this.#locks.keys();
  }
  values() {
    return this.#locks.values();
  }
  entries() {
    return this.#locks.entries();
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  #create(id) {
    const { lockCfg, retainMs, onOpen, onClose } = this.#cfg;
    let lock, ctid;
    const cleanUp = () => {
      if (lock?.state !== "ready") {
        return;
      }
      if (lock !== this.#locks.get(id)) {
        return;
      }
      this.#locks.delete(id);
    };
    const cfg = { ...lockCfg };
    cfg.onOpen = (lock2) => {
      clearTimeout(ctid);
      onOpen(this, { lock: lock2, id });
    };
    cfg.onClose = (lock2, hasNext) => {
      if (!hasNext) {
        ctid = (0, import_bounce.setTimeoutUnref)(cleanUp, retainMs, cfg.unref);
      }
      onClose(this, { lock: lock2, id, hasNext });
    };
    this.#locks.set(id, lock = new Lock(cfg));
    return lock;
  }
  get(id, throwError = false) {
    const lock = this.#locks.get(id);
    if (lock) {
      return lock;
    }
    if (!throwError) {
      return;
    }
    throw new Error(`Lock '${id}' does not exist`);
  }
  has(id, throwError = false) {
    return !!this.get(id, throwError);
  }
  ensure(id) {
    return this.#locks.get(id) ?? this.#create(id);
  }
};

// src/index.js
var index_default = Charon;
//# sourceMappingURL=index.cjs.map
