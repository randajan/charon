import { setTimeoutUnref } from "@randajan/bounce";
import { TxContext } from "./TxContext";


export class TxContextSimple extends TxContext {

    #tid;
    #log = [];

    touch(type) {
        const { totalMs, opMs, unref } = this.opt;

        const abortIsHard = totalMs > 0 && (!(opMs > 0) || totalMs <= opMs);
        const abortTrigger = abortIsHard ? "hard" : "soft";
        const ms = abortIsHard ? totalMs : opMs;

        if (ms > 0 && type === "op") {
            clearTimeout(this.#tid);
            this.#tid = setTimeoutUnref(_=>this.abort(this.#log, abortTrigger), ms, unref);
        }

        this.#log.push(type);
        return true;
    }

    clear() {
        super.clear();
        clearTimeout(this.#tid);
    }
}