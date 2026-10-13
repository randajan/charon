var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/queue.js
var queue_exports = {};
__export(queue_exports, {
  PromiseQueue: () => PromiseQueue,
  default: () => queue_default
});
module.exports = __toCommonJS(queue_exports);

// src/base/errors.js
var CharonError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
};
var PendingAbortError = class extends CharonError {
  constructor(code) {
    super(code, `Pending ${code} were aborted`);
  }
};

// src/base/queue/PromiseQueue.js
var PromiseQueue = class {
  #queue = [];
  #running = false;
  #drain = [];
  get size() {
    return this.#queue.length + (this.#running ? 1 : 0);
  }
  get state() {
    return this.#running ? "busy" : "idle";
  }
  isState(state) {
    return this.state === state;
  }
  run(callback) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ callback, resolve, reject });
      this.#next();
    });
  }
  abort(reason) {
    reason ??= new PendingAbortError("operations");
    const queue = this.#queue.splice(0);
    for (const { reject } of queue) {
      reject(reason);
    }
    this.#resolveDrain();
    return queue.length;
  }
  drain() {
    if (!this.size) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.#drain.push(resolve));
  }
  #next() {
    if (this.#running) {
      return;
    }
    const task = this.#queue.shift();
    if (!task) {
      return this.#resolveDrain();
    }
    this.#running = true;
    Promise.resolve().then(task.callback).then(task.resolve, task.reject).finally(() => {
      this.#running = false;
      this.#next();
    });
  }
  #resolveDrain() {
    if (this.size) {
      return;
    }
    for (const resolve of this.#drain.splice(0)) {
      resolve();
    }
  }
};

// src/queue.js
var queue_default = PromiseQueue;
//# sourceMappingURL=queue.cjs.map
