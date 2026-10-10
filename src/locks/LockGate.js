import { validFn, validObj } from "../tools";



export class LockGate {

    #cfg;
    #state = false;
    #currentKey;
    #queue = [];

    #generateKey;
    #onClose;

    constructor(cfg={}) {
        const { generateKey, onClose, ...passCfg } = validObj(cfg, true, "Lock cfg");
        this.#generateKey = validFn(generateKey, true, "cfg.generateKey");
        this.#onClose = validFn(onClose, false, "cfg.onClose");
        passCfg.throwError = !!passCfg.throwError;
        this.#cfg = Object.freeze(passCfg);
    }

    get cfg() { return this.#cfg; }

    get size() { return this.#queue.length; }
    get state() { return this.#state; }

    getOptThrowError(opt) {
        return opt?.throwError != null ? !!opt.throwError : this.cfg.throwError;
    }

    #setKey(state) {
        this.#state = state = !!state;
        return this.#currentKey = state ? this.#generateKey() : undefined;
    }

    checkTx(key, opt) {
        if (key === this.#currentKey) { return true; }
        if (!this.getOptThrowError(opt)) { return false; }
        throw new Error(`Lock '${key}' is unknown`);
    }

    async openTx(opt) {
        if (!this.#state) { return this.#setKey(true); }
        return new Promise(resolve => { this.#queue.push(resolve); });
    }

    closeTx(key, opt) {
        if (!this.checkTx(key, opt)) { return false; }

        const next = this.#queue.shift();

        const hasNext = !!next;
        const newKey = this.#setKey(hasNext);
        if (hasNext) { next(newKey); }
        
        this.#onClose?.(this, hasNext);

        return true;
    }

}