import { setTimeoutUnref } from "@randajan/bounce";

export class TxContext extends AbortController {

    #opt;
    #fctid;

    constructor(opt={}) {
        super();
        this.#opt = Object.freeze(opt);
    }

    get opt() { return this.#opt; }
    get key() { return this.#opt.key; }

    touch() { return false; }

    abort(log, trigger) {
        if (!this.signal.aborted) { super.abort({log, trigger}); }

        const { forceCloseMs, onForceClose, unref } = this.#opt;

        if (forceCloseMs > 0 && this.#fctid == null) {
            this.#fctid= setTimeoutUnref(onForceClose, forceCloseMs, unref);
        }
    }

    clear() {
        clearTimeout(this.#fctid);
        this.#opt.onClear?.(this);
    }
}