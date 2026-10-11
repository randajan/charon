import { Bounce, validateTimeout } from "@randajan/bounce";
import { TimeoutContext } from "./TimeoutContext";


export class MultiTimeoutContext extends TimeoutContext {

    #bounce;

    #getBounce(tx) {
        if (this.#bounce) { return this.#bounce; }

        const { totalMs, unref } = this.cfg;
        const onBounce = (log, trigger) => {
            this.replaceLog(log);
            const last = log.at(-1);
            const limit = trigger === "hard"
                ? "total"
                : last?.status === "op" ? "op" : "idle";
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
        const idleMs = validateTimeout(opt?.idleMs, "Transaction opt.idleMs") ?? this.cfg.idleMs;
        this.#touch(tx, "touch", idleMs);
    }

    onStartOp(tx, opCtx) {
        this.#touch(tx, "op", opCtx.opMs);
    }

    onEndOp(tx, opCtx) {
        if (!tx.signal.aborted) { this.#touch(tx, "idle", opCtx.idleMs); }
    }

    stop() {
        if (this.#bounce?.state) { this.#bounce.flush(); }
    }

}
