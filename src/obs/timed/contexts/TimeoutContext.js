import { setTimeoutUnref, validateTimeout } from "@randajan/bounce";
import { TxAbortError, TxTimeoutError } from "../../../base/errors";


export const formatTimeoutConfig = (opt = {}, fallback = {}, label = "Transaction opt") => {
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


export class TimeoutContext {

    #cfg;
    #log = [];
    #forceCloseId;
    #killId;

    constructor(cfg) {
        this.#cfg = cfg;
    }

    get cfg() { return this.#cfg; }
    get log() { return this.#log; }

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

    stop() {}

    onCreate(tx) {}
    onOpen(tx) {}
    onTouch(tx, opt) {}
    onAddOp(tx, opCtx) {}
    onStartOp(tx, opCtx) {}
    onEndOp(tx, opCtx) {}
    onClosing(tx) {
        const { forceKillMs, unref } = this.cfg;
        if (!(forceKillMs > 0) || this.#killId != null) { return; }

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
        if (!(forceCloseMs > 0) || this.#forceCloseId != null) { return; }

        this.#forceCloseId = setTimeoutUnref(() => {
            Promise.resolve(tx.close({ throwError: false })).catch(() => {});
        }, forceCloseMs, unref);
    }

    onDestroy() {
        this.stop();
        clearTimeout(this.#forceCloseId);
        clearTimeout(this.#killId);
        this.#forceCloseId = undefined;
        this.#killId = undefined;
    }

}
