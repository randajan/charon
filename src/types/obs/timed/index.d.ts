import { Observer } from "../..";
import type { TransactionOptions, Tx } from "../..";


export interface TimeoutOptions extends TransactionOptions {
    totalMs?: number;
    opMs?: number;
    idleMs?: number;
    forceCloseMs?: number;
    forceKillMs?: number;
    unref?: boolean;
}

export interface ResolvedTimeoutOptions {
    readonly singleOp: boolean;
    readonly totalMs: number | undefined;
    readonly opMs: number | undefined;
    readonly idleMs: number | undefined;
    readonly forceCloseMs: number | undefined;
    readonly forceKillMs: number | undefined;
    readonly unref: boolean;
}

export type TimeoutLimit = "total" | "op" | "idle";
export type TimeoutActivity = "idle" | "touch" | "op";

export interface TimeoutLogRecord {
    readonly status: TimeoutActivity;
    readonly ms: number | undefined;
    readonly ts: number;
}

export interface TimeoutOperationContext {
    readonly txCtx: TimeoutContext;
    readonly opMs: number | undefined;
    readonly idleMs: number | undefined;
}


export class TimeoutContext {
    constructor(config: ResolvedTimeoutOptions);

    readonly cfg: ResolvedTimeoutOptions;
    readonly log: readonly TimeoutLogRecord[];

    createOpCtx(options?: TimeoutOptions): TimeoutOperationContext;
    addLog(status: TimeoutActivity, ms?: number): TimeoutLogRecord;
    replaceLog(log: TimeoutLogRecord[]): void;
    timeout<TKey>(
        tx: Tx<TKey, TimeoutOptions>,
        limit: TimeoutLimit,
        ms: number | undefined,
        log?: Iterable<TimeoutLogRecord>
    ): void;

    stop(): void;

    onCreate<TKey>(tx: Tx<TKey, TimeoutOptions>): unknown;
    onOpen<TKey>(tx: Tx<TKey, TimeoutOptions>): unknown;
    onTouch<TKey>(tx: Tx<TKey, TimeoutOptions>, options?: TimeoutOptions): unknown;
    onAddOp<TKey>(tx: Tx<TKey, TimeoutOptions>, context: TimeoutOperationContext): unknown;
    onStartOp<TKey>(tx: Tx<TKey, TimeoutOptions>, context: TimeoutOperationContext): unknown;
    onEndOp<TKey>(tx: Tx<TKey, TimeoutOptions>, context: TimeoutOperationContext): unknown;
    onAbort<TKey>(tx: Tx<TKey, TimeoutOptions>, options?: TimeoutOptions): unknown;
    onClosing<TKey>(tx: Tx<TKey, TimeoutOptions>, options?: TimeoutOptions): unknown;
    onDestroy<TKey>(tx: Tx<TKey, TimeoutOptions>): unknown;
}

export class SingleTimeoutContext extends TimeoutContext {
    onStartOp<TKey>(tx: Tx<TKey, TimeoutOptions>, context: TimeoutOperationContext): void;
    onEndOp<TKey>(tx: Tx<TKey, TimeoutOptions>): void;
    stop(): void;
}

export class MultiTimeoutContext extends TimeoutContext {
    onOpen<TKey>(tx: Tx<TKey, TimeoutOptions>): void;
    onTouch<TKey>(tx: Tx<TKey, TimeoutOptions>, options?: TimeoutOptions): void;
    onStartOp<TKey>(tx: Tx<TKey, TimeoutOptions>, context: TimeoutOperationContext): void;
    onEndOp<TKey>(tx: Tx<TKey, TimeoutOptions>, context: TimeoutOperationContext): void;
    stop(): void;
}


export class TimeoutObserver extends Observer<
    TimeoutOptions,
    TimeoutContext,
    TimeoutOperationContext
> {
    constructor(options?: TimeoutOptions);

    createTxCtx<TKey>(
        tx: Tx<TKey, TimeoutOptions>,
        options: TimeoutOptions
    ): SingleTimeoutContext | MultiTimeoutContext;

    createOpCtx<TKey>(
        tx: Tx<TKey, TimeoutOptions>,
        context: TimeoutContext,
        options: TimeoutOptions
    ): TimeoutOperationContext;
}


export default TimeoutObserver;
