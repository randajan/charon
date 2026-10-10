export class SerialQueue {

    #tail = Promise.resolve();
    #size = 0;

    get size() { return this.#size; }
    get idle() { return this.#size === 0; }

    add(callback) {
        this.#size++;
        const task = this.#tail.then(callback).finally(() => { this.#size--; });
        this.#tail = task.then(() => undefined, () => undefined);
        return task;
    }

    drain() {
        return this.#tail;
    }
}