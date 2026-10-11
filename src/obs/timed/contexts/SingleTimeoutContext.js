import { setTimeoutUnref } from "@randajan/bounce";
import { TimeoutContext } from "./TimeoutContext";


export class SingleTimeoutContext extends TimeoutContext {

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
            this.#timeoutId = setTimeoutUnref(
                () => this.timeout(tx, limit, ms),
                ms,
                unref
            );
        }
    }

    onEndOp(tx) {
        if (tx.signal.aborted) { return; }
        this.stop();
        this.addLog("idle", 0);
    }

    stop() {
        clearTimeout(this.#timeoutId);
        this.#timeoutId = undefined;
    }

}
