export class Observer {

    #opt;

    constructor(opt = {}) {
        this.#opt = Object.freeze({ ...opt });
    }

    get opt() { return this.#opt; }

    createTxCtx(tx, opt) {
        return opt;
    }

    createOpCtx(tx, ctx, opt) {
        return {ctx, opt};
    }

    onCreate(tx, ctx) {}
    onOpen(tx, ctx) {}

    onTouch(tx, ctx, opt) {}

    onAddOp(tx, opCtx) {}
    onStartOp(tx, opCtx) {}
    onEndOp(tx, opCtx) {}

    onAbort(tx, ctx, opt) {}

    onClosing(tx, ctx, opt) {}
    onDestroy(tx, ctx) {}

}
