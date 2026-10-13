# @randajan/charon

[![NPM](https://img.shields.io/npm/v/@randajan/charon.svg)](https://www.npmjs.com/package/@randajan/charon) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Small asynchronous locks, transaction queues, and optional timeout handling for JavaScript.

Charon serializes work that must not overlap. Work submitted to the same lock runs in order, while unrelated locks remain concurrent. A transaction may contain one operation or retain ownership across several operations.

Timeout behavior is not hard-wired into the lock. It is provided by a separate observer, so the core remains small and custom lifecycle policies can be added without replacing the locking model.

## Features

- FIFO transaction ownership and FIFO operations.
- Independent locks grouped by any resource ID.
- Cooperative cancellation through `AbortSignal`.
- Manual abort, close, and last-resort lock release.
- Optional total, operation, and idle time limits.
- Grace periods between abort, close, and forced release.
- Extensible transaction lifecycle through observers.
- ESM, CommonJS, and TypeScript declarations.

## Installation and exports

```sh
npm install @randajan/charon
```

The package has three public entry points:

```js
import Charon, {
    Lock,
    Observer,
    PromiseQueue
} from "@randajan/charon";

// Minimal entry point when only the queue is needed:
import Queue from "@randajan/charon/queue";

import TimeoutObserver, {
    MultiTimeoutContext,
    SingleTimeoutContext,
    TimeoutContext
} from "@randajan/charon/obs/timed";
```

`Charon`, `PromiseQueue`, and `TimeoutObserver` are available as both default and named exports from their respective entry points. The smaller `@randajan/charon/queue` entry point exports only `PromiseQueue` and avoids loading the lock and collection layers.

## Quick start

Use `Charon` when work belongs to identifiable resources such as accounts, documents, tenants, or cache keys:

```js
import Charon from "@randajan/charon";
import TimeoutObserver from "@randajan/charon/obs/timed";

let nextTransactionId = 0;

const accounts = new Charon({
    generateKey: () => ++nextTransactionId,
    observer: new TimeoutObserver({
        opMs: 5_000,
        idleMs: 1_000,
        totalMs: 15_000,
        forceCloseMs: 500,
        forceKillMs: 500
    })
});

const updateAccount = (accountId, amount) => {
    const lock = accounts.ensure(accountId);

    return lock.run(async tx => {
        const account = await loadAccount(accountId, {
            signal: tx.signal
        });

        account.balance += amount;
        await saveAccount(account, { signal: tx.signal });
        return account.balance;
    });
};
```

Calls for the same `accountId` are serialized. Calls for different IDs may run at the same time.

```js
await Promise.all([
    updateAccount("account-a", 10),
    updateAccount("account-a", 20), // waits for the first account-a call
    updateAccount("account-b", 30)  // independent of account-a
]);
```

## Mental model

```text
Charon                       keyed collection
├── account-a → Lock         one owner at a time
│   ├── active transaction   owns the lock
│   │   ├── operation 1      runs first
│   │   └── operation 2      runs second
│   └── waiting transactions FIFO
└── account-b → Lock         independent of account-a

Observer                     optional lifecycle policy
└── TimeoutObserver          timers and recovery policy
```

- `PromiseQueue` runs asynchronous callbacks one at a time.
- `Lock` grants ownership to one transaction at a time.
- A transaction (`tx`) owns the lock and has its own operation queue.
- `Charon` maintains one independent `Lock` for each ID.
- `Observer` reacts to lifecycle events without being part of the lock algorithm.

The key distinction is between a **transaction** and an **operation**:

- `lock.run()` creates a short transaction containing one operation.
- `lock.runTx()` creates a transaction that may contain several operations.
- `lock.openTx()` exposes the transaction lifecycle manually.

## Choosing the right level

| Need | Use |
| --- | --- |
| Serialize work for many resource IDs | `Charon` + `charon.ensure(id)` |
| Protect one resource | `Lock` |
| Execute one protected operation | `lock.run()` |
| Keep ownership across several operations | `lock.runTx()` |
| Connect ownership to an external lifecycle | `lock.openTx()` |
| Add time limits and automatic recovery | `TimeoutObserver` |
| Add custom monitoring or lifecycle policy | Extend `Observer` |
| Only serialize callbacks | `PromiseQueue` |

For normal application code, start with `charon.ensure(id).run(...)` or `lock.run(...)`.

## Lock

A `Lock` serializes complete transactions. `generateKey` is the only required option.

```js
import { Lock } from "@randajan/charon";

const lock = new Lock({
    generateKey: () => Symbol("transaction")
});
```

### `lock.run(operation, options?)`

Creates a single-operation transaction, waits for ownership, runs the callback, and closes in a `finally` block.

```js
const result = await lock.run(async tx => {
    return performProtectedWork({ signal: tx.signal });
});
```

The callback result becomes the result of `run()`. If it rejects, the transaction is still closed and the next waiting transaction can proceed. Multiple `run()` calls on one lock execute in submission order.

### `lock.runTx(transaction, options?)`

Keeps ownership for a callback containing several serialized operations:

```js
const result = await lock.runTx(async tx => {
    const source = await tx.run(() => loadSource());
    const transformed = await tx.run(() => transform(source));
    await tx.run(() => saveResult(transformed));
    return transformed;
});
```

Operations may be submitted concurrently; the internal queue still executes them one at a time:

```js
await lock.runTx(async tx => {
    const first = tx.run(stepOne);
    const second = tx.run(stepTwo);
    await Promise.all([first, second]);
});
```

`runTx()` always calls `tx.close()` in a `finally` block. This is the safest multi-operation API.

### Manual transactions

Use `openTx()` only when ownership must outlive one callback or follow an external lifecycle:

```js
const tx = await lock.openTx();

try {
    const value = await tx.run(() => loadValue());
    await tx.run(() => saveValue(value));
} finally {
    await tx.close();
}
```

Always await `close()`. It rejects new operations, waits for queued operations to settle, destroys the transaction, and transfers ownership to the next waiter.

### Lock reference

- `lock.state` is the current transaction state, or `"ready"` without an owner.
- `lock.isState(state)` compares the current state.
- `lock.size` is the number of transactions waiting for ownership. It does not include the active transaction.
- `lock.getTx(key, throwError?)` returns the active public transaction matching `key`.
- `lock.abortAll(reason?, options?)` aborts the active transaction and rejects all waiting transactions.

`abortAll()` returns the number of waiting transactions removed from the queue; it does not count the active transaction. Aborting does not close the active transaction—close it explicitly or configure `forceCloseMs`.

### Lock configuration

| Option | Meaning |
| --- | --- |
| `generateKey` | Required function creating a non-null transaction key. |
| `observer` | Optional `Observer`, such as `TimeoutObserver`. |
| `throwError` | Throw on invalid transaction actions instead of returning `false`. Default: `false`. |
| `onOpen(lock)` | Called when `openTx()` is requested. |
| `onClose(lock, hasNext)` | Called after ownership is released. |

Callbacks are synchronous and are not awaited. Their exceptions are suppressed.

## Transaction API

Every transaction callback receives a public `tx` object:

```js
tx.key       // ownership identifier
tx.lock      // parent Lock
tx.signal    // AbortSignal
tx.state     // lifecycle state
tx.size      // running + queued operations
```

Possible states are:

| State | Meaning |
| --- | --- |
| `"pending"` | Created but waiting for ownership. |
| `"idle"` | Owns the lock, with no active operation. |
| `"busy"` | An operation is running. |
| `"aborted"` | The transaction was aborted. |
| `"closing"` | Close is waiting for operations. |
| `"destroyed"` | Ownership was released. |

### `tx.run(operation, options?)`

Adds an operation to the transaction's FIFO queue. The operation receives the same transaction:

```js
const value = await tx.run(async currentTx => {
    currentTx.signal.throwIfAborted();
    return doWork();
});
```

After abort or after closing begins, new operations are refused. With default non-throwing behavior, `tx.run()` resolves to `false`.

### `tx.touch(options?)`

Notifies the observer about activity while idle. `TimeoutObserver` uses this to restart `idleMs`.

```js
if (!tx.touch()) {
    // Busy, aborted, closing, or destroyed.
}
```

Touch is valid only in the `"idle"` state. Use `opMs` to limit active work.

### `tx.abort(reason?, options?)`

Aborts the transaction signal and rejects operations that are queued but have not started.

```js
tx.abort(new Error("cancelled by the owner"));
```

Without a reason, Charon creates `TxAbortError`. A custom `Error` is preserved exactly as `tx.signal.reason`.

Abort is cooperative: the currently running callback is not forcibly interrupted. Pass `tx.signal` to cancellable APIs and inspect it during long work.

```js
await tx.run(async tx => {
    tx.signal.throwIfAborted();
    await performStepOne();
    tx.signal.throwIfAborted();
    await performStepTwo();
});
```

Abort does not release ownership. It must be followed by `close()`, manually or through a timeout policy.

### `tx.close(options?)`

Moves the transaction to `"closing"`, refuses further operations, waits for the queue to drain, then releases the lock.

```js
await tx.close();
```

If a running operation never settles, `close()` also remains pending. `forceKillMs` exists for this recovery case.

### `tx.kill(options?)`

Immediately detaches a transaction that is both aborted and closing. The required order is:

```text
abort → close → kill
```

```js
tx.abort(new Error("operation is stuck"));
const closing = tx.close();

// If close cannot finish:
tx.kill();
void closing;
```

Calling `kill()` before abort or close returns `false` by default. Kill releases the **lock**, not the JavaScript operation. The old operation may continue and overlap the next transaction, so kill is a last-resort availability mechanism.

### Invalid actions and `throwError`

By default, an invalid lifecycle action returns `false` (or `undefined` from `getTx`) instead of throwing. Set `throwError: true` on the lock or a call when invalid usage should fail loudly.

```js
const lock = new Lock({
    generateKey: () => Symbol(),
    throwError: true
});

await tx.run(operation, { throwError: false }); // per-call override
```

Errors thrown by user operations are never suppressed.

## Charon: locks grouped by ID

`Charon` is a lifecycle-aware map of `Lock` instances.

```js
const resources = new Charon({
    generateKey: () => Symbol("transaction"),
    retainMs: 60_000
});
```

### Creating and finding locks

`charon.ensure(id)` returns an existing lock or creates it lazily:

```js
const documentLock = resources.ensure(documentId);
await documentLock.run(tx => updateDocument(documentId, tx.signal));
```

This explicit `ensure(id) → Lock` design keeps all transaction behavior on `Lock` and `tx`, rather than duplicating it as ID-prefixed proxy methods.

- `charon.get(id, options?)` returns an existing lock without creating one.
- `charon.has(id, options?)` reports whether a lock is currently retained.
- A missing ID returns `undefined`/`false`, or throws with `{ throwError: true }`.
- `charon.size` is the number of retained lock instances.

`has(id)` says nothing about the underlying account, file, or database record.

### Iteration

Charon can be inspected like a map:

```js
for (const [id, lock] of resources) {
    console.log(id, lock.state, lock.size);
}

resources.keys();
resources.values();
resources.entries();
```

### Retention and cleanup

When a lock becomes ready without a waiter, Charon retains it for `retainMs` and then removes it. The default is `60_000` ms. Reusing it before cleanup cancels removal.

```js
const resources = new Charon({
    generateKey,
    retainMs: 5_000,
    unref: true
});
```

`unref: true` prevents a supported Node.js cleanup timer from keeping the process alive by itself.

### Charon callbacks

```js
const resources = new Charon({
    generateKey,

    onOpen(charon, { id, lock }) {
        console.log("opened", id);
    },

    onClose(charon, { id, lock, hasNext }) {
        console.log("closed", id, { hasNext });
    }
});
```

Callbacks are synchronous, are not awaited, and their exceptions are suppressed by the lock.

## TimeoutObserver

Timeout handling is an optional export:

```js
import { Lock } from "@randajan/charon";
import TimeoutObserver from "@randajan/charon/obs/timed";

const lock = new Lock({
    generateKey: () => Symbol(),
    observer: new TimeoutObserver({
        totalMs: 30_000,
        opMs: 5_000,
        idleMs: 1_000,
        forceCloseMs: 500,
        forceKillMs: 500,
        unref: false
    })
});
```

### Timeout options

| Option | Meaning |
| --- | --- |
| `totalMs` | Maximum lifetime of a multi-operation transaction. |
| `opMs` | Maximum duration of one operation. |
| `idleMs` | Maximum idle period before or between operations. |
| `forceCloseMs` | Delay from abort to automatic `close()`. |
| `forceKillMs` | Delay from the start of close to automatic `kill()`. |
| `unref` | Do not keep Node.js alive solely because of observer timers. |

Omit a limit or use `0` to disable it. Defaults belong to the observer. Transaction options override the defaults, and operation options can override `opMs` and the following `idleMs`:

```js
const tx = await lock.openTx({
    totalMs: 60_000,
    idleMs: 5_000
});

try {
    await tx.run(operation, {
        opMs: 20_000,
        idleMs: 10_000
    });
} finally {
    await tx.close();
}
```

### Single and multi-operation timing

`TimeoutObserver` selects a context using `singleOp`:

- `lock.run()` automatically enables `singleOp` and uses `SingleTimeoutContext`.
- `openTx()` and `runTx()` normally use `MultiTimeoutContext`.

The single-operation context needs one effective timer. The multi-operation context tracks total lifetime independently while operation and idle limits restart as activity changes. This distinction is normally internal.

### Timeout reasons and logs

An expired limit aborts the signal with `TxTimeoutError`:

```js
tx.signal.addEventListener("abort", () => {
    const reason = tx.signal.reason;

    console.log(reason.code); // "total", "op", or "idle"
    console.log(reason.ms);   // configured limit
    console.log(reason.log);  // activity records
}, { once: true });
```

Each log record has this shape:

```js
{
    status: "idle" | "touch" | "op",
    ms: 1_000,
    ts: 1760000000000
}
```

The log is diagnostic. Application logic should primarily use `signal.aborted`, `reason.code`, and `reason.ms`. When `tx.abort()` creates the default `TxAbortError`, `TimeoutObserver` attaches the activity log. A custom abort error remains untouched.

### Automatic recovery

```text
totalMs / opMs / idleMs expires
              │
              ▼
            abort
              │ forceCloseMs
              ▼
            close
              │ forceKillMs
              ▼
             kill
              │
              ▼
      next transaction acquires the lock
```

- Abort requests cooperative cancellation and removes queued operations.
- Close waits for the running operation to settle.
- Kill releases the lock if close remains stuck.

`forceKillMs` starts only after closing begins. Automatic forced release therefore normally needs both `forceCloseMs` and `forceKillMs`; alternatively application code can call `close()` after abort.

## Errors

Library-specific errors derive from `CharonError` and carry a short `code`.

| Error | Typical code | Meaning |
| --- | --- | --- |
| `CharonError` | any string | Common base class. |
| `TxError` | any string | Transaction error with an activity `log`. |
| `TxTimeoutError` | `"total"`, `"op"`, `"idle"` | Timeout error with `ms` and `log`. |
| `TxAbortError` | `"manual"` | Default reason created by `tx.abort()`. |
| `PendingAbortError` | `"operations"`, `"transactions"` | Pending queue entries were removed. |

```js
import { TxTimeoutError } from "@randajan/charon";

if (tx.signal.reason instanceof TxTimeoutError) {
    console.error(tx.signal.reason.code, tx.signal.reason.ms);
}
```

## Custom observers

Extend `Observer` to add metrics, tracing, auditing, or another policy:

```js
import { Lock, Observer } from "@randajan/charon";

class MetricsObserver extends Observer {
    createTxCtx(tx, options) {
        return {
            createdAt: Date.now(),
            operationCount: 0,
            options
        };
    }

    createOpCtx(tx, txCtx, options) {
        return { txCtx, startedAt: undefined, options };
    }

    onStartOp(tx, opCtx) {
        opCtx.txCtx.operationCount++;
        opCtx.startedAt = Date.now();
    }

    onEndOp(tx, opCtx) {
        recordOperationDuration(Date.now() - opCtx.startedAt);
    }

    onDestroy(tx, txCtx) {
        recordTransaction({
            duration: Date.now() - txCtx.createdAt,
            operations: txCtx.operationCount
        });
    }
}

const lock = new Lock({
    generateKey: () => Symbol(),
    observer: new MetricsObserver({ service: "billing" })
});
```

The constructor stores a frozen shallow copy in `observer.opt`. `createTxCtx()` creates data shared by one transaction; `createOpCtx()` creates data for one operation.

Lifecycle hooks are:

```text
onCreate → onOpen → onAddOp → onStartOp → onEndOp
                  ↘ onTouch
                  ↘ onAbort → onClosing → onDestroy
```

Hook return values are ignored and hook exceptions are suppressed so monitoring code cannot break cleanup. Errors from `createTxCtx()` or `createOpCtx()` may propagate, so context factories should remain small and deterministic.

The timed context classes are exported for advanced extensions, but most users only need `TimeoutObserver`.

## PromiseQueue

`PromiseQueue` is the low-level FIFO queue used by transactions and can be used independently.

```js
const queue = new PromiseQueue();

const first = queue.run(async () => {
    await writePartOne();
    return 1;
});

const second = queue.run(async () => {
    await writePartTwo();
    return 2;
});

console.log(await Promise.all([first, second])); // [1, 2]
await queue.drain();
```

- `size` includes the running and queued callbacks.
- `state` is `"idle"` or `"busy"`.
- `drain()` waits for the queue to become empty.
- `abort(reason?)` rejects queued callbacks and returns their count.
- The running callback is not stopped by `abort()`.
- A rejected callback does not block later callbacks.

## Common mistakes

- **Assuming abort stops JavaScript:** it only signals cancellation.
- **Forgetting to close:** wrap manual transactions in `try/finally`.
- **Using kill normally:** it may let old and new work overlap.
- **Calling `touch()` while busy:** touch is only an idle keep-alive.
- **Expecting methods directly on Charon:** resolve a `Lock` with `ensure(id)` first.
- **Treating `has(id)` as a domain lookup:** it only describes retained locks.
- **Acquiring several IDs inconsistently:** use a deterministic order to avoid deadlocks.

## Runtime guarantees

- Waiting transactions acquire one lock in FIFO order.
- Operations inside a transaction run in FIFO order.
- Different Charon IDs remain concurrent.
- Rejected operations do not poison their queue.
- User errors and custom abort reasons are preserved.
- No callback is forcibly terminated.
- Observers may automate recovery without changing the lock primitive.

## License

MIT
