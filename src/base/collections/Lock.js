import { PendingAbortError } from "../errors";
import { TxPrivate } from "../transactions/TxPrivate";
import { Observer } from "../observers/Observer";
import { validFn, validObj } from "../../tools";




export class Lock {

    #cfg;

    #queue = [];
    #tx;

    constructor(cfg = {}) {
        cfg = validObj(cfg, true, "Lock cfg");
        const { generateKey, onOpen, onClose, observer, throwError } = cfg;

        this.#cfg = {
            throwError:!!throwError,
            observer,
            generateKey: validFn(generateKey, true, "Lock cfg.generateKey"),
            onOpen: validFn(onOpen, false, "Lock cfg.onOpen") ?? (() => { }),
            onClose: validFn(onClose, false, "Lock cfg.onClose") ?? (() => { }),
            onDestroyTx: this.#detachTx.bind(this)
        };
    }

    get size() { return this.#queue.length; }
    get state() { return !this.#tx ? "ready" : this.#tx.state; }

    isState(state) { return this.state === state; }

    formatThrowError(throwError = undefined) {
        return throwError != null ? !!throwError : this.#cfg.throwError;
    }

    #createTx(opt) {
        const { generateKey, onDestroyTx, observer } = this.#cfg;
        const key = generateKey();
        if (key == null) { throw new TypeError(`Lock cfg.generateKey returned null or undefined`); }

        return new TxPrivate(this, key, observer, opt, onDestroyTx);
    }

    #attachTx(tx) { return (this.#tx = tx).open(); }

    #detachTx(tx, opt) {
        if (this.#tx !== tx) { return; }
        this.#tx = undefined;

        const next = this.#queue.shift();
        const hasNext = !!next;

        if (hasNext) { next.resolve(this.#attachTx(next.tx)); }

        try { this.#cfg.onClose(this, hasNext); } catch {}
    }

    getTx(key, throwError = undefined) {
        if (key === this.#tx?.key) { return this.#tx.public; }
        if (!this.formatThrowError(throwError)) { return; }
        throw new Error(`Transaction '${key}' not found`);
    }

    async openTx(opt) {
        try { this.#cfg.onOpen(this); } catch {}
        const tx = this.#createTx(opt);
        if (!this.#tx) { return this.#attachTx(tx); }
        return new Promise((resolve, reject) => this.#queue.push({ resolve, reject, tx }));
    }

    abortAll(reason, opt) {
        reason ??= new PendingAbortError("transactions");

        this.#tx?.abort(reason, opt);

        const queue = this.#queue.splice(0);
        for (const { reject, tx } of queue) {
            tx.destroy()
            reject(reason);
        }
        return queue.length;
    }

    async run(op, opt) {
        const txPublic = await this.openTx({...(opt||{}), singleOp:true});

        try { return await txPublic.run(op, opt); }
        finally { await txPublic.close(opt); }
    }

    async runTx(tx, opt) {
        const txPublic = await this.openTx(opt);

        try { return await tx(txPublic); }
        finally { await txPublic.close(opt); }
    }
}
