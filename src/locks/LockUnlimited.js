import { LockGate } from "./LockGate";
import { SerialQueue } from "../queue/SerialQueue";


export class LockUnlimited extends LockGate {

    static optWithoutThrowError(opt) {
        if (!opt) { return; }
        const { throwError, ...passOpt } = opt;
        return passOpt;
    }

    #ops = new SerialQueue();
    #closing = false;

    get state() {
        if (!super.state) { return "ready"; }
        return this.#ops.idle ? "idle" : "busy";
    }

    isState(state) { return this.state === state; }

    async openTx(opt) {
        const key = await super.openTx(opt);
        this.#closing = false;
        return key;
    }

    async closeTx(key, opt) {
        if (!this.checkTx(key, opt)) { return false; }
        this.#closing = true;
        await this.#ops.drain();

        return super.closeTx(key, opt);
    }

    async runInTx(key, op, opt) {
        if (!this.checkTx(key, opt)) { return false; }

        if (this.#closing) {
            if (!this.getOptThrowError(opt)) { return false; }
            throw new Error(`Lock '${key}' is closing`);
        }

        return this.#ops.add(op);
    }

    async run(op, opt) {
        const key = await this.openTx(opt);

        try { return await this.runInTx(key, op, opt); }
        finally { await this.closeTx(key, LockUnlimited.optWithoutThrowError(opt)); }
    }


    async runTx(tx, opt) {
        const key = await this.openTx(opt);

        const run = (op, opt)=>this.runInTx(key, op, opt);

        try {return await tx(run); }
        finally { await this.closeTx(key, LockUnlimited.optWithoutThrowError(opt)); }
    }
}