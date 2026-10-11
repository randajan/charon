import { Lock } from "./Lock";
import { validFn, validObj } from "../../tools";
import { setTimeoutUnref, validateTimeout } from "@randajan/bounce";


export class Charon {

    #locks = new Map();
    #cfg = {};

    constructor(cfg = {}) {
        const cfgAll = validObj(cfg, false, "Charon cfg");
        const { onOpen, onClose, retainMs, ...lockCfg } = cfgAll;
        this.#cfg.lockCfg = lockCfg;
        this.#cfg.retainMs = validateTimeout(retainMs, "Charon cfg.retainMs") ?? 60_000;
        this.#cfg.onOpen = validFn(onOpen, false, "Charon cfg.onOpen") ?? (()=>{});
        this.#cfg.onClose = validFn(onClose, false, "Charon cfg.onClose") ?? (()=>{});
    }

    get size() { return this.#locks.size; }

    keys() { return this.#locks.keys(); }
    values() { return this.#locks.values(); }
    entries() { return this.#locks.entries(); }
    [Symbol.iterator]() { return this.entries(); }

    getOptThrowError(opt) {
        return opt?.throwError != null ? !!opt.throwError : !!this.#cfg.lockCfg.throwError;
    }

    #create(id) {
        const { lockCfg, retainMs, onOpen, onClose } = this.#cfg;
        let lock, ctid;

        const cleanUp = ()=>{
            if (lock?.state !== "ready") { return; }
            if (lock !== this.#locks.get(id)) { return; }
            this.#locks.delete(id);
        }

        const cfg = {...lockCfg};

        cfg.onOpen = (lock)=>{
            clearTimeout(ctid);
            onOpen(this, { lock, id });
        }

        cfg.onClose = (lock, hasNext) => {
            if (!hasNext) { ctid = setTimeoutUnref(cleanUp, retainMs, cfg.unref); }
            onClose(this, { lock, id, hasNext });
        };

        this.#locks.set(id, lock = new Lock(cfg));
        return lock;
    }

    get(id, opt) {
        const lock = this.#locks.get(id);
        if (lock) { return lock; }
        if (!this.getOptThrowError(opt)) { return; }
        throw new Error(`Lock '${id}' does not exist`);
    }

    has(id, opt) { return !!this.get(id, opt); }
    ensure(id) { return this.#locks.get(id) ?? this.#create(id); }

}
