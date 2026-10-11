import {
  Observer,
  TxAbortError,
  TxTimeoutError
} from "../../chunk-27B7V7QV.mjs";

// src/obs/timed/contexts/MultiTimeoutContext.js
import { Bounce, validateTimeout as validateTimeout2 } from "@randajan/bounce";

// src/obs/timed/contexts/TimeoutContext.js
import { setTimeoutUnref, validateTimeout } from "@randajan/bounce";
var formatTimeoutConfig = (opt = {}, fallback = {}, label = "Transaction opt") => {
  opt ??= {};
  return Object.freeze({
    singleOp: opt.singleOp != null ? !!opt.singleOp : !!fallback.singleOp,
    totalMs: validateTimeout(opt.totalMs, `${label}.totalMs`) ?? fallback.totalMs,
    opMs: validateTimeout(opt.opMs, `${label}.opMs`) ?? fallback.opMs,
    idleMs: validateTimeout(opt.idleMs, `${label}.idleMs`) ?? fallback.idleMs,
    forceCloseMs: validateTimeout(opt.forceCloseMs, `${label}.forceCloseMs`) ?? fallback.forceCloseMs,
    forceKillMs: validateTimeout(opt.forceKillMs, `${label}.forceKillMs`) ?? fallback.forceKillMs,
    unref: opt.unref != null ? !!opt.unref : !!fallback.unref
  });
};
var TimeoutContext = class {
  #cfg;
  #log = [];
  #forceCloseId;
  #killId;
  constructor(cfg) {
    this.#cfg = cfg;
  }
  get cfg() {
    return this.#cfg;
  }
  get log() {
    return this.#log;
  }
  createOpCtx(opt = {}) {
    opt ??= {};
    return Object.freeze({
      txCtx: this,
      opMs: validateTimeout(opt.opMs, "Operation opt.opMs") ?? this.cfg.opMs,
      idleMs: validateTimeout(opt.idleMs, "Operation opt.idleMs") ?? this.cfg.idleMs
    });
  }
  addLog(status, ms) {
    const record = Object.freeze({ status, ms, ts: Date.now() });
    this.#log.push(record);
    return record;
  }
  replaceLog(log) {
    this.#log = log;
  }
  timeout(tx, limit, ms, log = this.log) {
    tx.abort(new TxTimeoutError(limit, ms, log), { throwError: false });
  }
  stop() {
  }
  onCreate(tx) {
  }
  onOpen(tx) {
  }
  onTouch(tx, opt) {
  }
  onAddOp(tx, opCtx) {
  }
  onStartOp(tx, opCtx) {
  }
  onEndOp(tx, opCtx) {
  }
  onClosing(tx) {
    const { forceKillMs, unref } = this.cfg;
    if (!(forceKillMs > 0) || this.#killId != null) {
      return;
    }
    this.#killId = setTimeoutUnref(
      () => tx.kill({ throwError: false }),
      forceKillMs,
      unref
    );
  }
  onAbort(tx) {
    this.stop();
    if (tx.signal.reason instanceof TxAbortError) {
      tx.signal.reason.log = Object.freeze([...this.log]);
    }
    const { forceCloseMs, unref } = this.cfg;
    if (!(forceCloseMs > 0) || this.#forceCloseId != null) {
      return;
    }
    this.#forceCloseId = setTimeoutUnref(() => {
      Promise.resolve(tx.close({ throwError: false })).catch(() => {
      });
    }, forceCloseMs, unref);
  }
  onDestroy() {
    this.stop();
    clearTimeout(this.#forceCloseId);
    clearTimeout(this.#killId);
    this.#forceCloseId = void 0;
    this.#killId = void 0;
  }
};

// src/obs/timed/contexts/MultiTimeoutContext.js
var MultiTimeoutContext = class extends TimeoutContext {
  #bounce;
  #getBounce(tx) {
    if (this.#bounce) {
      return this.#bounce;
    }
    const { totalMs, unref } = this.cfg;
    const onBounce = (log, trigger) => {
      this.replaceLog(log);
      const last = log.at(-1);
      const limit = trigger === "hard" ? "total" : last?.status === "op" ? "op" : "idle";
      const ms = trigger === "hard" ? totalMs : last?.ms;
      this.timeout(tx, limit, ms, log);
    };
    return this.#bounce = new Bounce(onBounce, { hardMs: totalMs, unref });
  }
  #touch(tx, status, ms) {
    const record = this.addLog(status, ms);
    this.#getBounce(tx).attach(record, ms);
  }
  onOpen(tx) {
    this.#touch(tx, "idle", this.cfg.idleMs);
  }
  onTouch(tx, opt) {
    const idleMs = validateTimeout2(opt?.idleMs, "Transaction opt.idleMs") ?? this.cfg.idleMs;
    this.#touch(tx, "touch", idleMs);
  }
  onStartOp(tx, opCtx) {
    this.#touch(tx, "op", opCtx.opMs);
  }
  onEndOp(tx, opCtx) {
    if (!tx.signal.aborted) {
      this.#touch(tx, "idle", opCtx.idleMs);
    }
  }
  stop() {
    if (this.#bounce?.state) {
      this.#bounce.flush();
    }
  }
};

// src/obs/timed/contexts/SingleTimeoutContext.js
import { setTimeoutUnref as setTimeoutUnref2 } from "@randajan/bounce";
var SingleTimeoutContext = class extends TimeoutContext {
  #timeoutId;
  onStartOp(tx, opCtx) {
    const { totalMs, unref } = this.cfg;
    const { opMs } = opCtx;
    const totalWins = totalMs > 0 && (!(opMs > 0) || totalMs <= opMs);
    const limit = totalWins ? "total" : "op";
    const ms = totalWins ? totalMs : opMs;
    this.addLog("op", ms);
    clearTimeout(this.#timeoutId);
    if (ms > 0) {
      this.#timeoutId = setTimeoutUnref2(
        () => this.timeout(tx, limit, ms),
        ms,
        unref
      );
    }
  }
  onEndOp(tx) {
    if (tx.signal.aborted) {
      return;
    }
    this.stop();
    this.addLog("idle", 0);
  }
  stop() {
    clearTimeout(this.#timeoutId);
    this.#timeoutId = void 0;
  }
};

// src/obs/timed/observer/TimeoutObserver.js
var TimeoutObserver = class extends Observer {
  #cfg;
  constructor(opt = {}) {
    super(opt);
    this.#cfg = formatTimeoutConfig(opt, {}, "TimeoutObserver opt");
  }
  createTxCtx(tx, opt) {
    const cfg = formatTimeoutConfig(opt, this.#cfg);
    return cfg.singleOp ? new SingleTimeoutContext(cfg) : new MultiTimeoutContext(cfg);
  }
  createOpCtx(tx, ctx, opt) {
    return ctx.createOpCtx(opt);
  }
  onCreate(tx, ctx) {
    return ctx.onCreate(tx);
  }
  onOpen(tx, ctx) {
    return ctx.onOpen(tx);
  }
  onTouch(tx, ctx, opt) {
    return ctx.onTouch(tx, opt);
  }
  onAddOp(tx, opCtx) {
    return opCtx.txCtx.onAddOp(tx, opCtx);
  }
  onStartOp(tx, opCtx) {
    return opCtx.txCtx.onStartOp(tx, opCtx);
  }
  onEndOp(tx, opCtx) {
    return opCtx.txCtx.onEndOp(tx, opCtx);
  }
  onAbort(tx, ctx, opt) {
    return ctx.onAbort(tx, opt);
  }
  onClosing(tx, ctx, opt) {
    return ctx.onClosing(tx, opt);
  }
  onDestroy(tx, ctx) {
    return ctx.onDestroy(tx);
  }
};

// src/obs/timed/index.js
var timed_default = TimeoutObserver;
export {
  MultiTimeoutContext,
  SingleTimeoutContext,
  TimeoutContext,
  TimeoutObserver,
  timed_default as default
};
//# sourceMappingURL=index.mjs.map
