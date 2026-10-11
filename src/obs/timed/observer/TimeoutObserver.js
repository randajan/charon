import { Observer } from "../../../base/observers/Observer";
import { MultiTimeoutContext } from "../contexts/MultiTimeoutContext";
import { SingleTimeoutContext } from "../contexts/SingleTimeoutContext";
import { formatTimeoutConfig } from "../contexts/TimeoutContext";


export class TimeoutObserver extends Observer {

    #cfg;

    constructor(opt = {}) {
        super(opt);
        this.#cfg = formatTimeoutConfig(opt, {}, "TimeoutObserver opt");
    }

    createTxCtx(tx, opt) {
        const cfg = formatTimeoutConfig(opt, this.#cfg);
        return cfg.singleOp
            ? new SingleTimeoutContext(cfg)
            : new MultiTimeoutContext(cfg);
    }

    createOpCtx(tx, ctx, opt) {
        return ctx.createOpCtx(opt);
    }

    onCreate(tx, ctx) { return ctx.onCreate(tx); }
    onOpen(tx, ctx) { return ctx.onOpen(tx); }
    onTouch(tx, ctx, opt) { return ctx.onTouch(tx, opt); }

    onAddOp(tx, opCtx) { return opCtx.txCtx.onAddOp(tx, opCtx); }
    onStartOp(tx, opCtx) { return opCtx.txCtx.onStartOp(tx, opCtx); }
    onEndOp(tx, opCtx) { return opCtx.txCtx.onEndOp(tx, opCtx); }

    onAbort(tx, ctx, opt) { return ctx.onAbort(tx, opt); }
    onClosing(tx, ctx, opt) { return ctx.onClosing(tx, opt); }
    onDestroy(tx, ctx) { return ctx.onDestroy(tx); }

}
