/** A value that may be returned synchronously or asynchronously. */
export type MaybePromise<T> = T | PromiseLike<T>;

/** Common behavior for operations that reference an existing transaction. */
export interface LockOptions {
    /** Throw when the transaction is unknown or in an invalid state. */
    throwError?: boolean;
}

/** Timeout values that may be configured for an individual transaction. */
export interface LockTransactionOptions extends LockOptions {
    /** Maximum lifetime of the complete transaction in milliseconds. */
    totalMs?: number;

    /** Maximum duration of one operation in milliseconds. */
    opMs?: number;

    /** Maximum idle time between operations in milliseconds. */
    idleMs?: number;

    /** Delay between aborting and forcibly closing a transaction. */
    forceCloseMs?: number;
}

export type LockTimeoutName = "totalMs" | "opMs" | "idleMs" | "forceCloseMs";
export type LockState = "ready" | "idle" | "busy";
export type LockAbortTrigger = "soft" | "hard";
export type LockActivity = "idle" | "touch" | "op";

/** Value stored in `signal.reason` when a limited transaction expires. */
export interface LockAbortReason {
    log: LockActivity[];
    trigger: LockAbortTrigger;
}

/** Abort signal passed to operations managed by a limited lock. */
export interface LockAbortSignal extends AbortSignal {
    readonly reason: LockAbortReason | undefined;
}

/** Handle returned when a limited transaction is opened explicitly. */
export interface LockTransaction<TKey> {
    key: TKey;
    signal: LockAbortSignal;
}

export interface LockGateConfig<
    TKey = unknown,
    TLock = LockGate<TKey>
> extends LockOptions {
    /** Creates the unique key used to identify a new transaction. */
    generateKey: () => TKey;

    /** Called synchronously whenever a transaction releases the gate. */
    onClose?: (lock: TLock, hasNext: boolean) => unknown;
}

export type LockUnlimitedConfig<TKey = unknown> = LockGateConfig<
    TKey,
    LockUnlimited<TKey>
>;

export type LockLimitedConfig<TKey = unknown> = Omit<
    LockUnlimitedConfig<TKey>,
    "onClose"
> & LockTransactionOptions & {
    /** Do not keep the process alive solely because of active timers. */
    unref?: boolean;

    /** Called synchronously whenever a transaction releases the lock. */
    onClose?: (lock: LockLimited<TKey>, hasNext: boolean) => unknown;
};

export interface ResolvedLockConfig {
    readonly throwError: boolean;
}

export interface ResolvedLockLimitedConfig extends ResolvedLockConfig {
    readonly totalMs: number | undefined;
    readonly opMs: number | undefined;
    readonly idleMs: number | undefined;
    readonly forceCloseMs: number | undefined;
    readonly unref: boolean;
}

/** A small FIFO queue that executes asynchronous callbacks one at a time. */
export class SerialQueue {
    /** Number of queued or currently running callbacks. */
    readonly size: number;

    /** Whether no callback is queued or running. */
    readonly idle: boolean;

    /** Add a callback and return its individual result. */
    add<TResult>(callback: () => MaybePromise<TResult>): Promise<TResult>;

    /** Wait until every callback currently in the queue has settled. */
    drain(): Promise<void>;
}

/**
 * Owns one transaction at a time and hands ownership to waiting callers in
 * FIFO order.
 */
export class LockGate<
    TKey = unknown,
    TState = boolean,
    TOpenResult = TKey,
    TCloseResult = boolean
> {
    constructor(config: LockGateConfig<TKey, LockGate<TKey, TState, TOpenResult, TCloseResult>>);

    readonly cfg: Readonly<ResolvedLockConfig>;

    /** Number of transactions waiting to acquire the gate. */
    readonly size: number;

    /** Current state of the gate. */
    readonly state: TState;

    getOptThrowError(options?: LockOptions): boolean;

    /** Check whether a key owns the current transaction. */
    checkTx(key: TKey, options?: LockOptions): boolean;

    /** Wait for ownership of the gate and return the new transaction handle. */
    openTx(options?: LockOptions): Promise<TOpenResult>;

    /** Release the current transaction. */
    closeTx(key: TKey, options?: LockOptions): TCloseResult;
}

/** Queues one operation inside an explicitly owned transaction. */
export interface LockRunner<
    TArguments extends unknown[] = [],
    TOptions extends LockOptions = LockOptions
> {
    <TResult>(
        operation: (...args: TArguments) => MaybePromise<TResult>,
        options?: TOptions
    ): Promise<TResult | false>;
}

/** Callback used by `LockUnlimited.runTx`. */
export type LockUnlimitedRunner = LockRunner<[], LockOptions>;

/** Serializes operations without applying time limits. */
export class LockUnlimited<
    TKey = unknown,
    TOpenResult = TKey,
    TOperationArguments extends unknown[] = [],
    TTransactionArguments extends unknown[] = [],
    TOptions extends LockOptions = LockOptions
>
    extends LockGate<TKey, LockState, TOpenResult, Promise<boolean>> {
    constructor(config: LockUnlimitedConfig<TKey>);

    static optWithoutThrowError<TOptions extends LockOptions>(
        options?: TOptions
    ): Omit<TOptions, "throwError"> | undefined;

    isState(state: LockState): boolean;

    /** Queue an operation inside the currently owned transaction. */
    runInTx<TResult>(
        key: TKey,
        operation: (...args: TOperationArguments) => MaybePromise<TResult>,
        options?: TOptions
    ): Promise<TResult | false>;

    /** Acquire the lock, run one operation, and release it. */
    run<TResult>(
        operation: (...args: TOperationArguments) => MaybePromise<TResult>,
        options?: TOptions
    ): Promise<TResult>;

    /** Acquire the lock for a callback that may enqueue several operations. */
    runTx<TResult>(
        transaction: (
            run: LockRunner<TOperationArguments, TOptions>,
            ...args: TTransactionArguments
        ) => MaybePromise<TResult>,
        options?: TOptions
    ): Promise<TResult>;
}

/** Callback used by `LockLimited.runTx`. */
export type LockLimitedRunner = LockRunner<
    [signal: LockAbortSignal],
    LockTransactionOptions
>;

/** Serializes operations and aborts transactions that exceed their limits. */
export class LockLimited<TKey = unknown>
    extends LockUnlimited<
        TKey,
        LockTransaction<TKey>,
        [signal: LockAbortSignal],
        [signal: LockAbortSignal],
        LockTransactionOptions
    > {
    constructor(config: LockLimitedConfig<TKey>);

    readonly cfg: Readonly<ResolvedLockLimitedConfig>;

    getOptMs(
        name: LockTimeoutName,
        options?: LockTransactionOptions,
        transactionFallback?: boolean
    ): number | undefined;

    /** Wait for ownership and start a transaction with timeout handling. */
    openTx(options?: LockTransactionOptions): Promise<LockTransaction<TKey>>;

    /** Restart the idle timeout of the current idle transaction. */
    touchTx(key: TKey, options?: LockTransactionOptions): boolean;
}

export interface CharonCloseEvent<TId, TKey> {
    lock: LockLimited<TKey>;
    id: TId;
    hasNext: boolean;
}

export type CharonConfig<TId = unknown, TKey = unknown> = Omit<
    LockLimitedConfig<TKey>,
    "onClose"
> & {
    /** Called whenever one of the managed transactions releases its lock. */
    onClose?: (
        charon: Charon<TId, TKey>,
        event: CharonCloseEvent<TId, TKey>
    ) => unknown;
};

/** Maintains an independent limited lock for every id. */
export class Charon<TId = unknown, TKey = unknown> {
    constructor(config: CharonConfig<TId, TKey>);

    /** Number of ids with an active or waiting transaction. */
    readonly size: number;

    get(id: TId, options: LockOptions & { throwError: true }): LockLimited<TKey>;
    get(id: TId, options?: LockOptions): LockLimited<TKey> | undefined;

    has(id: TId, options?: LockOptions): boolean;

    run<TResult>(
        id: TId,
        operation: (signal: LockAbortSignal) => MaybePromise<TResult>,
        options?: LockTransactionOptions
    ): Promise<TResult>;

    openTx(
        id: TId,
        options?: LockTransactionOptions
    ): Promise<LockTransaction<TKey>>;

    checkTx(id: TId, key: TKey, options?: LockOptions): boolean;

    touchTx(id: TId, key: TKey, options?: LockTransactionOptions): boolean;

    runInTx<TResult>(
        id: TId,
        key: TKey,
        operation: (signal: LockAbortSignal) => MaybePromise<TResult>,
        options?: LockTransactionOptions
    ): Promise<TResult | false>;

    closeTx(
        id: TId,
        key: TKey,
        options?: LockOptions
    ): Promise<boolean> | false;

    runTx<TResult>(
        id: TId,
        transaction: (
            run: LockLimitedRunner,
            signal: LockAbortSignal
        ) => MaybePromise<TResult>,
        options?: LockTransactionOptions
    ): Promise<TResult>;
}

export default Charon;
