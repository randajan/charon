



export class TxPublic {

    #tx;

    constructor(txContext) {
        this.#tx = txContext;
    }

    get state() { return this.#tx.state; }

    isState(state) { return this.#tx.isState(state); }
    
    get lock() { return this.#tx.lock; }
    get key() { return this.#tx.key; }
    get size() { return this.#tx.size; }

    get signal() { return this.#tx.signal; }

    run(op, opt) { return this.#tx.run(op, opt); }
    touch(opt) { return this.#tx.touch(opt); }
    abort(reason, opt) { return this.#tx.abort(reason, opt); }
    close(opt) { return this.#tx.close(opt); }

    kill(opt) { return this.#tx.kill(opt); }
}