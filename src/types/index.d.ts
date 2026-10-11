export type MaybePromise<T> = T | PromiseLike<T>;

export interface ControlOptions {
    throwError?: boolean;
}

export interface TransactionOptions extends ControlOptions {
    singleOp?: boolean;
}

export type PromiseQueueState = "idle" | "busy";
export type TransactionState = PromiseQueueState | "pending" | "aborted" | "closing" | "destroyed";
export type LockState = "ready" | TransactionState;


export class CharonError<TCode extends string = string> extends Error {
    constructor(code: TCode, message: string);
    readonly code: TCode;
}

export class TxError<
    TCode extends string = string,
    TLog = unknown
> extends CharonError<TCode> {
    constructor(code: TCode, message: string, log?: Iterable<TLog>);
    log: readonly TLog[];
}

export class TxTimeoutError<
    TLimit extends string = "total" | "op" | "idle",
    TLog = unknown
> extends TxError<TLimit, TLog> {
    constructor(limit: TLimit, ms: number | undefined, log?: Iterable<TLog>);
    readonly ms: number | undefined;
}

export class TxAbortError<TLog = unknown> extends TxError<"manual", TLog> {
    constructor(log?: Iterable<TLog>);
}

export class PendingAbortError<TCode extends string = string> extends CharonError<TCode> {
    constructor(code: TCode);
}


export class PromiseQueue {
    readonly size: number;
    readonly state: PromiseQueueState;

    isState(state: PromiseQueueState): boolean;

    run<TResult>(callback: () => MaybePromise<TResult>): Promise<TResult>;
    abort(reason?: Error): number;
    drain(): Promise<void>;
}


export interface Tx<
    TKey = unknown,
    TOptions extends TransactionOptions = TransactionOptions
> {
    readonly state: TransactionState;
    readonly lock: Lock<TKey, TOptions>;
    readonly key: TKey;
    readonly size: number;
    readonly signal: AbortSignal;

    isState(state: TransactionState): boolean;

    run<TResult>(
        operation: (tx: Tx<TKey, TOptions>) => MaybePromise<TResult>,
        options?: TOptions
    ): Promise<TResult | false>;

    touch(options?: TOptions): boolean;
    abort(reason?: Error, options?: TOptions): boolean;
    close(options?: TOptions): Promise<boolean>;
    kill(options?: TOptions): boolean;
}


export class Observer<
    TOptions extends TransactionOptions = TransactionOptions,
    TTxContext = TOptions,
    TOperationContext = { ctx: TTxContext; opt: TOptions }
> {
    constructor(options?: Partial<TOptions>);

    readonly opt: Readonly<Partial<TOptions>>;

    createTxCtx<TKey>(tx: Tx<TKey, TOptions>, options: TOptions): TTxContext;
    createOpCtx<TKey>(
        tx: Tx<TKey, TOptions>,
        context: TTxContext,
        options: TOptions
    ): TOperationContext;

    onCreate<TKey>(tx: Tx<TKey, TOptions>, context: TTxContext): unknown;
    onOpen<TKey>(tx: Tx<TKey, TOptions>, context: TTxContext): unknown;
    onTouch<TKey>(tx: Tx<TKey, TOptions>, context: TTxContext, options?: TOptions): unknown;

    onAddOp<TKey>(tx: Tx<TKey, TOptions>, context: TOperationContext): unknown;
    onStartOp<TKey>(tx: Tx<TKey, TOptions>, context: TOperationContext): unknown;
    onEndOp<TKey>(tx: Tx<TKey, TOptions>, context: TOperationContext): unknown;

    onAbort<TKey>(tx: Tx<TKey, TOptions>, context: TTxContext, options?: TOptions): unknown;
    onClosing<TKey>(tx: Tx<TKey, TOptions>, context: TTxContext, options?: TOptions): unknown;
    onDestroy<TKey>(tx: Tx<TKey, TOptions>, context: TTxContext): unknown;
}


export interface LockConfig<
    TKey = unknown,
    TOptions extends TransactionOptions = TransactionOptions
> extends ControlOptions {
    generateKey: () => TKey;
    observer?: Observer<TOptions, any, any>;
    onOpen?: (lock: Lock<TKey, TOptions>) => unknown;
    onClose?: (lock: Lock<TKey, TOptions>, hasNext: boolean) => unknown;
}

export class Lock<
    TKey = unknown,
    TOptions extends TransactionOptions = TransactionOptions
> {
    constructor(config: LockConfig<TKey, TOptions>);

    readonly size: number;
    readonly state: LockState;

    isState(state: LockState): boolean;
    formatThrowError(throwError?: boolean): boolean;

    getTx(key: TKey, throwError: true): Tx<TKey, TOptions>;
    getTx(key: TKey, throwError?: boolean): Tx<TKey, TOptions> | undefined;

    openTx(options?: TOptions): Promise<Tx<TKey, TOptions>>;
    abortAll(reason?: Error, options?: TOptions): number;

    run<TResult>(
        operation: (tx: Tx<TKey, TOptions>) => MaybePromise<TResult>,
        options?: TOptions
    ): Promise<TResult | false>;

    runTx<TResult>(
        transaction: (tx: Tx<TKey, TOptions>) => MaybePromise<TResult>,
        options?: TOptions
    ): Promise<TResult>;
}


export interface CharonEvent<
    TId = unknown,
    TKey = unknown,
    TOptions extends TransactionOptions = TransactionOptions
> {
    readonly id: TId;
    readonly lock: Lock<TKey, TOptions>;
}

export interface CharonCloseEvent<
    TId = unknown,
    TKey = unknown,
    TOptions extends TransactionOptions = TransactionOptions
> extends CharonEvent<TId, TKey, TOptions> {
    readonly hasNext: boolean;
}

export type CharonConfig<
    TId = unknown,
    TKey = unknown,
    TOptions extends TransactionOptions = TransactionOptions
> = Omit<LockConfig<TKey, TOptions>, "onOpen" | "onClose"> & {
    retainMs?: number;
    unref?: boolean;
    onOpen?: (charon: Charon<TId, TKey, TOptions>, event: CharonEvent<TId, TKey, TOptions>) => unknown;
    onClose?: (charon: Charon<TId, TKey, TOptions>, event: CharonCloseEvent<TId, TKey, TOptions>) => unknown;
}

export class Charon<
    TId = unknown,
    TKey = unknown,
    TOptions extends TransactionOptions = TransactionOptions
> implements Iterable<[TId, Lock<TKey, TOptions>]> {
    constructor(config: CharonConfig<TId, TKey, TOptions>);

    readonly size: number;

    keys(): IterableIterator<TId>;
    values(): IterableIterator<Lock<TKey, TOptions>>;
    entries(): IterableIterator<[TId, Lock<TKey, TOptions>]>;
    [Symbol.iterator](): IterableIterator<[TId, Lock<TKey, TOptions>]>;

    get(id: TId, options: ControlOptions & { throwError: true }): Lock<TKey, TOptions>;
    get(id: TId, options?: ControlOptions): Lock<TKey, TOptions> | undefined;
    has(id: TId, options?: ControlOptions): boolean;
    ensure(id: TId): Lock<TKey, TOptions>;
}


export default Charon;
