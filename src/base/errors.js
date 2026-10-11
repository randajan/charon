const TIMEOUT_MESSAGES = {
    total: "Transaction exceeded totalMs",
    op: "Operation exceeded opMs",
    idle: "Transaction exceeded idleMs"
};


export class CharonError extends Error {
    constructor(code, message) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
    }
}


export class TxError extends CharonError {
    constructor(code, message, log = []) {
        super(code, message);
        this.log = Object.freeze([...log]);
    }
}


export class TxTimeoutError extends TxError {
    constructor(limit, ms, log) {
        const message = TIMEOUT_MESSAGES[limit] ?? `Transaction exceeded '${limit}' time limit`;
        super(limit, `${message} (${ms} ms)`, log);
        this.ms = ms;
    }
}


export class TxAbortError extends TxError {
    constructor(log) {
        super("manual", "Transaction was interrupted", log);
    }
}


export class PendingAbortError extends CharonError {
    constructor(code) {
        super(code, `Pending ${code} were aborted`);
    }
}
