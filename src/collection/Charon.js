import { LockLimited } from "../locks/LockLimited";
import { validObj } from "../tools";

export class Charon {

    #locks = new Map();
    #cfg;

    constructor(cfg = {}) {
        this.#cfg = validObj(cfg, false, "Charon cfg");
    }

    get size() { return this.#locks.size; }

    #create(id) {
        let lock;

        const onClose = (lock, hasNext) => {
            if (hasNext && this.#locks.get(id) === lock) {
                this.#locks.delete(id);
            }
            this.#cfg.onClose?.(this, { lock, id, hasNext });
        };

        lock = new LockLimited({ ...this.#cfg, onClose });
        this.#locks.set(id, lock);
        return lock;
    }

    #getOrAdd(id) { return this.#locks.get(id) ?? this.#create(id); }
    get(id, opt={}) {
        const lock = this.#locks.get(id);
        if (lock) { return lock; }
        if (!opt?.throwError) { return; }
        throw new Error(`Lock '${id}' does not exist`);
    }
    has(id, opt={}) { return !!this.get(id, opt); }

    async run(id, callback, opt) { return this.#getOrAdd(id).run(callback, opt); }

    openTx(id, opt) { return this.#getOrAdd(id).openTx(opt); }

    checkTx(id, key, opt={}) {
        const lock = this.get(id, opt);
        return lock ? lock.checkTx(key, opt) : false;
    }

    touchTx(id, key, opt={}) {
        const lock = this.get(id, opt);
        return lock ? lock.touchTx(key, opt) : false;
    }

    async runInTx(id, key, callback, opt={}) {
        const lock = this.get(id, opt);
        return lock ? lock.runInTx(key, callback, opt) : false;
    }

    closeTx(id, key, opt={}) {
        const lock = this.get(id, opt);
        return lock ? lock.closeTx(key, opt) : false;
    }

    async runTx(id, tx, opt={}) { return this.#getOrAdd(id).runTx(tx, opt); }
}