import { TxAbortError } from "../errors";
import { PromiseQueue } from "../queue/PromiseQueue";
import { TxPublic } from "./TxPublic";


export class TxPrivate extends PromiseQueue {

    #cfg;
    #ac = new AbortController();

    #state = "pending";

    constructor(lock, key, observer, opt, onDestroy=(()=>{})) {
        super();

        opt ??= {};
        const throwError = opt.throwError;
        const txPublic = new TxPublic(this);
        
        this.#cfg = { lock, key, throwError, public:txPublic, observer, onDestroy };
        const ctx = this.#cfg.ctx = observer?.createTxCtx(txPublic, opt);

        try { observer?.onCreate(txPublic, ctx); } catch {}
    }

    get public() { return this.#cfg.public; }
    get lock() { return this.#cfg.lock; }
    get key() { return this.#cfg.key; }
    get signal() { return this.#ac.signal; }
    get state() { return this.#state ?? super.state; }

    isState(state) { return this.state === state; }

    formatThrowError(opt) {
        return this.lock.formatThrowError(opt?.throwError ?? this.#cfg.throwError);
    }

    check(condition, message, opt) {
        if (condition) { return true; }
        if (!this.formatThrowError(opt)) { return false; }
        throw new Error(`Transaction '${this.key}' ${message}`);
    }

    mustIdle(opt) { return this.check(this.isState("idle"), "is not idling", opt); }
    mustAborted(opt) { return this.check(this.signal.aborted, "was not aborted", opt); }
    mustClosing(opt) { return this.check(this.isState("closing"), "is not closing", opt); }
    notAborted(opt) { return this.check(!this.isState("aborted"), "was aborted", opt); }
    notClosing(opt) { return this.check(!this.isState("closing"), "is closing", opt); }
    notDestroyed(opt) { return this.check(!this.isState("destroyed"), "was destroyed", opt); }

    open() {
        if (this.#state !== "pending") { return this.public; }
        const { observer, public:txPublic, ctx } = this.#cfg;
        this.#state = null; //state by parent (super.state)
        try { observer?.onOpen(txPublic, ctx); } catch {}
        return txPublic;
    }

    touch(opt) {
        if (!this.mustIdle(opt)) { return false; }
        const { observer, public:txPublic, ctx } = this.#cfg;
        try { observer?.onTouch(txPublic, ctx, opt); } catch {}
        return true;
    }

    async run(op, opt) {
        const { observer, public:txPublic, ctx } = this.#cfg;
        if (!this.notDestroyed(opt) || !this.notClosing(opt) || !this.notAborted(opt)) { return false; }

        const opCtx = observer?.createOpCtx(txPublic, ctx, opt);

        try { observer?.onAddOp(txPublic, opCtx); } catch {}
        try {
            return await super.run(_=>{
                try { observer?.onStartOp(txPublic, opCtx); } catch {}
                return op(txPublic);
            });
        }
        finally {
            try { observer?.onEndOp(txPublic, opCtx); } catch {}
        }
    }

    abort(reason, opt) {
        if (!this.notDestroyed(opt) || !this.notAborted(opt)) { return false; }
        const { observer, public:txPublic, ctx } = this.#cfg;
        reason = reason ?? new TxAbortError();
        this.#ac.abort(reason);
        super.abort(reason);
        this.#state = "aborted";
        try { observer?.onAbort(txPublic, ctx, opt); } catch {}
        return true;
    }

    async close(opt) {
        if (!this.notDestroyed(opt) || !this.notClosing(opt)) { return false; }
        const { observer, public:txPublic, ctx } = this.#cfg;

        try { observer?.onClosing(txPublic, ctx, opt); } catch {}

        this.#state = "closing";
        await super.drain();

        this.destroy();

        return true;
    }

    destroy() {
        if (this.#state === "destroyed") { return false; }
        const { observer, public:txPublic, ctx, onDestroy } = this.#cfg;
        this.#state = "destroyed";

        try { onDestroy(this); } catch {}
        try { observer?.onDestroy(txPublic, ctx); } catch {}

        return true;
    }

    kill(opt) {
        if (!this.mustAborted(opt) || !this.mustClosing(opt)) { return false; }
        return this.destroy();
    }

}
