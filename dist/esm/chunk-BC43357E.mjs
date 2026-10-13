// src/base/errors.js
var TIMEOUT_MESSAGES = {
  total: "Transaction exceeded totalMs",
  op: "Operation exceeded opMs",
  idle: "Transaction exceeded idleMs"
};
var CharonError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
};
var TxError = class extends CharonError {
  constructor(code, message, log = []) {
    super(code, message);
    this.log = Object.freeze([...log]);
  }
};
var TxTimeoutError = class extends TxError {
  constructor(limit, ms, log) {
    const message = TIMEOUT_MESSAGES[limit] ?? `Transaction exceeded '${limit}' time limit`;
    super(limit, `${message} (${ms} ms)`, log);
    this.ms = ms;
  }
};
var TxAbortError = class extends TxError {
  constructor(log) {
    super("manual", "Transaction was interrupted", log);
  }
};
var PendingAbortError = class extends CharonError {
  constructor(code) {
    super(code, `Pending ${code} were aborted`);
  }
};

export {
  CharonError,
  TxError,
  TxTimeoutError,
  TxAbortError,
  PendingAbortError
};
//# sourceMappingURL=chunk-BC43357E.mjs.map
