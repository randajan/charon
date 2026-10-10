import { Bounce } from "@randajan/bounce";
import { TxContext } from "./TxContext";


export class TxContextBounced extends TxContext {

    #bounce;

    touch(type, ms) {
        if (this.signal.aborted) { return false; }
        if (!this.#bounce) {
            const { totalMs, unref } = this.opt;
            this.#bounce = new Bounce(this.abort.bind(this), {
                hardMs:totalMs,
                unref
            });
        }
        this.#bounce.attach(type, ms);
        return true;
    }

    clear() {
        super.clear();
        this.#bounce.flush();
    }
}