import { PendingAbortError } from "../errors";


export class PromiseQueue {

    #queue = [];
    #running = false;
    #drain = [];

    get size() { return this.#queue.length + (this.#running ? 1 : 0); }
    get state() { return this.#running ? "busy" : "idle"; }

    isState(state) { return this.state === state; }

    run(callback) {
        return new Promise((resolve, reject)=>{
            this.#queue.push({ callback, resolve, reject });
            this.#next();
        });
    }

    abort(reason) {
        reason ??= new PendingAbortError("operations");

        const queue = this.#queue.splice(0);
        for (const { reject } of queue) { reject(reason); }

        this.#resolveDrain();
        return queue.length;
    }

    drain() {
        if (!this.size) { return Promise.resolve(); }
        return new Promise(resolve=>this.#drain.push(resolve));
    }

    #next() {
        if (this.#running) { return; }

        const task = this.#queue.shift();
        if (!task) { return this.#resolveDrain(); }

        this.#running = true;

        Promise.resolve()
            .then(task.callback)
            .then(task.resolve, task.reject)
            .finally(()=>{
                this.#running = false;
                this.#next();
            });
    }

    #resolveDrain() {
        if (this.size) { return; }
        for (const resolve of this.#drain.splice(0)) { resolve(); }
    }
}
