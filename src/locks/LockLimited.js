import { LockUnlimited } from "./LockUnlimited";
import { TxContextBounced } from "../contexts/TxContextBounced";
import { TxContextSimple } from "../contexts/TxContextSimple";
import { validateTimeout } from "@randajan/bounce";


export class LockLimited extends LockUnlimited {

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

        this.#clearTx = tx=>{ if (this.#tx === tx) { this.#tx = undefined; } };
    }

    getOptMs(msName, opt, txOptFallback=false) {
        const ms = validateTimeout(opt?.[msName], `Lock opt.${msName}`);
        if (ms !== null) { return ms; }
        const txMs = txOptFallback ? this.#tx?.opt[msName] : undefined;
        return txMs ?? this.cfg[msName];
    }

    checkTx(key, opt = {}) {
        if (!super.checkTx(key, opt)) { return false; }
        if (this.#tx?.key === key) { return true; }
        if (!this.getOptThrowError(opt)) { return false; }
        throw new Error(`Lock '${key}' unstable state reached.`);
    }

    #touchTx(key, type, ms, opt = {}) {
        if (!this.checkTx(key, opt)) { return false; }
        if (this.#tx.touch(type, ms)) { return true; }
        if (!this.getOptThrowError(opt)) { return false; }
        throw new Error(`Lock '${key}' expired`);
    }

    async #openTx(TxContextClass, opt={}) {
        const { unref } = this.cfg;
        const totalMs = this.getOptMs("totalMs", opt);
        const opMs = this.getOptMs("opMs", opt);
        const idleMs = this.getOptMs("idleMs", opt);
        const forceCloseMs = this.getOptMs("forceCloseMs", opt);

        const key = await super.openTx(opt);
        const noThrowOpt = LockUnlimited.optWithoutThrowError(opt);
        const tx = this.#tx = new TxContextClass({
            key, totalMs, idleMs, opMs, forceCloseMs, unref,
            onForceClose: _ => this.closeTx(key, noThrowOpt),
            onClear: this.#clearTx
        });

        return tx;
    }

    async openTx(opt) {
        const tx = await this.#openTx(TxContextBounced, opt);
        const { key, signal, opt:{ idleMs } } = tx;

        tx.touch("idle", idleMs);
        return { key, signal };
    }

    async closeTx(key, opt) {
        const tx = this.#tx;
        const closed = await super.closeTx(key, opt);
        if (closed) { tx?.clear(); }
        return closed;
    }

    touchTx(key, opt) {
        if (!this.isState("idle")) {
            if (!this.getOptThrowError(opt)) { return false; }
            throw new Error(`Lock '${key}' is not idle`);
        }

        const idleMs = this.getOptMs("idleMs", opt, true);
        return this.#touchTx(key, "touch", idleMs, opt);
    }

    async run(op, opt) {
        const tx = await this.#openTx(TxContextSimple, opt);
        const { key, signal } = tx;

        try {
            return await super.runInTx(key, ()=>{ tx.touch("op"); return op(signal); }, opt);
        } finally {
            await this.closeTx(key, LockUnlimited.optWithoutThrowError(opt));
        }
    }

    async runInTx(key, op, opt) {
        const opMs = this.getOptMs("opMs", opt, true);
        const idleMs = this.getOptMs("idleMs", opt, true);

        return super.runInTx(key, async () => {
            if (!this.#touchTx(key, "op", opMs, opt)) { return false; }

            try { return await op(this.#tx.signal); }
            finally { this.#touchTx(key, "idle", idleMs, LockUnlimited.optWithoutThrowError(opt)); }
        }, opt);
    }

    async runTx(tx, opt) {
        const { key, signal } = await this.openTx(opt);
        const run = (op, opt) => this.runInTx(key, op, opt);

        try { return await tx(run, signal); }
        finally { await this.closeTx(key, LockUnlimited.optWithoutThrowError(opt)); }
    }
}