# @randajan/charon

[![NPM](https://img.shields.io/npm/v/@randajan/charon.svg)](https://www.npmjs.com/package/@randajan/charon) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Lightweight asynchronous locks and keyed transaction queues for JavaScript.

Charon serializes asynchronous work that must not overlap. It can protect one
resource with a lock, or maintain an independent lock for every resource ID.
Operations for the same ID run in order, while operations for different IDs
remain concurrent.

The package includes several layers that can also be used independently:

- `SerialQueue` executes asynchronous callbacks in FIFO order.
- `LockGate` grants exclusive ownership to one transaction at a time.
- `LockUnlimited` adds serialized operations and transaction helpers.
- `LockLimited` adds abort signals and transaction time limits.
- `Charon` creates and removes `LockLimited` instances by resource ID.

## Installation

```sh
npm install @randajan/charon
```

The package provides ESM, CommonJS, and TypeScript declarations.

```js
import Charon, {
    LockGate,
    LockLimited,
    LockUnlimited,
    SerialQueue
} from "@randajan/charon";
```

`Charon` is both the default export and a named export.

## Quick start

```js
import Charon from "@randajan/charon";
import { randomUUID } from "node:crypto";

const accounts = new Charon({
    generateKey: randomUUID,
    opMs: 5_000,
    idleMs: 1_000,
    totalMs: 15_000,
    forceCloseMs: 500
});

const updateA = accounts.run("account-a", async signal => {
    const account = await loadAccount("account-a", { signal });
    account.balance += 10;
    await saveAccount(account, { signal });
    return account.balance;
});

const updateAAgain = accounts.run("account-a", async signal => {
    // Starts only after updateA has settled and released account-a.
    return recalculateAccount("account-a", { signal });
});

const updateB = accounts.run("account-b", async signal => {
    // Runs independently and may overlap both account-a requests.
    return recalculateAccount("account-b", { signal });
});

const [balance, recalculatedA, recalculatedB] = await Promise.all([
    updateA,
    updateAAgain,
    updateB
]);
```

## Mental model

Charon uses three nested concepts:

1. A **Charon ID** identifies the protected resource, such as an account ID,
   document path, tenant, or cache key.
2. A **transaction** temporarily owns that ID's lock. Transactions waiting for
   the same lock are admitted in FIFO order.
3. An **operation** is a callback queued inside the owning transaction.

```text
Charon
├── account-a → LockLimited
│   ├── current transaction
│   │   ├── operation 1
│   │   └── operation 2
│   └── waiting transactions
└── account-b → LockLimited
    └── independent transaction and operations
```

Calling `run()` creates a transaction containing one operation. Calling
`runTx()` creates a transaction that may contain several operations. The
lower-level `openTx()`, `runInTx()`, and `closeTx()` methods expose the same
lifecycle manually.

## Choosing an API

Use the highest-level method that fits the task:

| Requirement | Recommended API |
| --- | --- |
| Run one operation for one resource ID | `charon.run(id, operation)` |
| Keep one resource locked across several operations | `charon.runTx(id, transaction)` |
| Integrate ownership with an external lifecycle | `openTx` / `runInTx` / `closeTx` |
| Protect one resource without an ID map | `LockLimited` or `LockUnlimited` |
| Only serialize callbacks | `SerialQueue` |
| Only coordinate ownership keys | `LockGate` |

For most application code, start with `Charon.run()` or `Charon.runTx()`.

## Configuration

`Charon` and every lock require `generateKey`. A transaction key is an opaque
capability used to prove ownership when calling `checkTx`, `runInTx`,
`touchTx`, or `closeTx`.

```js
let nextKey = 0;

const locks = new Charon({
    generateKey: () => ++nextKey,
    throwError: false,
    totalMs: 30_000,
    opMs: 5_000,
    idleMs: 1_000,
    forceCloseMs: 500,
    unref: false,
    onClose(charon, event) {
        console.log(event.id, event.hasNext, charon.size);
    }
});
```

### `generateKey`

```ts
generateKey: () => TransactionKey
```

Required. Called whenever a transaction acquires a lock. Keys only need to be
opaque and unique enough that stale callers cannot accidentally control the
current transaction. A counter, symbol-producing function, or UUID generator
is suitable.

### `throwError`

Defaults to `false`. When disabled, methods that target an unknown, expired,
closing, or otherwise invalid transaction generally return `false`. When
enabled, they throw instead.

Most methods also accept `{ throwError }` per call. The per-call value overrides
the lock configuration.

When a Charon ID is completely absent, there is no lock configuration to
consult. Pass `{ throwError: true }` directly to `get`, `has`, `checkTx`,
`touchTx`, `runInTx`, or `closeTx` if a missing ID must throw.

```js
const result = await locks.runInTx("account-a", staleKey, operation);
console.log(result); // false

await locks.runInTx("account-a", staleKey, operation, {
    throwError: true
}); // throws
```

### Timeout options

Timeouts are available on `LockLimited` and `Charon`.

| Option | Meaning | Timer begins or restarts |
| --- | --- | --- |
| `totalMs` | Maximum lifetime of the whole transaction | Once, when ownership is acquired |
| `opMs` | Maximum duration of an operation | When an operation starts |
| `idleMs` | Maximum time between operations | On open, `touchTx`, and after an operation |
| `forceCloseMs` | Grace period between abort and automatic close | When the signal is aborted |

Use `0` or omit a timeout to disable that limit. Timeout values must be finite,
non-negative numbers no greater than `2 ** 31 - 1`.

Transaction options override lock defaults:

```js
await locks.run("slow-report", buildReport, {
    opMs: 60_000,
    totalMs: 90_000
});
```

For an explicitly opened transaction, its resolved timeout values become the
defaults for its operations. A particular `runInTx()` or `touchTx()` call may
override the relevant `opMs` or `idleMs` again.

### `unref`

Defaults to `false` in Charon. When `true`, supported runtimes call `unref()` on
timeout handles, so Charon's timers alone do not keep an otherwise idle Node.js
process alive.

Use `unref: false` for short-lived processes that must remain alive until a
timeout is delivered. This option has no effect in runtimes without timer
handle `unref()` support.

### `onClose`

For `Charon`, the callback receives the collection and an event object:

```js
const locks = new Charon({
    generateKey,
    onClose(charon, { lock, id, hasNext }) {
        // hasNext is true when ownership immediately passed to a waiter.
    }
});
```

For standalone locks, the signature is `(lock, hasNext)`.

Callbacks run synchronously during close and are not awaited. Keep them small
and do not throw from them. When a Charon lock closes without a waiting
transaction, Charon removes it from its internal map automatically.

## Abort and timeout behavior

Timeouts abort the transaction's `AbortSignal`; they do not forcibly terminate
JavaScript execution or automatically reject an operation.

```js
await locks.run("resource", async signal => {
    const response = await fetch(url, { signal });
    return response.json();
});
```

Pass the signal to APIs that support cancellation, or inspect it explicitly:

```js
await locks.run("resource", async signal => {
    signal.throwIfAborted();
    await performStepOne();
    signal.throwIfAborted();
    await performStepTwo();
});
```

If an operation ignores the signal, it may continue after the timeout. Closing
a lock waits for its queued operations to settle. Consequently,
`forceCloseMs` releases abandoned idle transactions automatically, but cannot
magically stop a running callback that ignores cancellation.

### Abort reason

Charon aborts with a structured value in `signal.reason`:

```js
{
    trigger: "soft",          // "soft" or "hard"
    log: ["idle", "touch"]   // transaction activity
}
```

- `trigger: "hard"` means `totalMs` expired.
- `trigger: "soft"` means the active `opMs` or `idleMs` limit expired.
- `log` records activity as `"idle"`, `"touch"`, and `"op"` entries.

The exact log is useful for diagnostics, but application logic should usually
react to `signal.aborted` and `trigger`, not depend on a specific log length.

## Charon API

### `new Charon(config)`

Creates an initially empty keyed lock collection. Locks are created lazily by
`run`, `runTx`, and `openTx`.

```js
const documents = new Charon({
    generateKey: () => Symbol("document transaction"),
    idleMs: 1_000
});
```

### `charon.size`

Number of IDs that currently have an active or waiting transaction. Finished
locks with no waiters are removed automatically.

### `charon.run(id, operation, options?)`

Acquires the ID's lock, runs one operation, and releases the lock in a
`finally` block.

```js
const result = await documents.run(documentId, async signal => {
    return updateDocument(documentId, { signal });
});
```

The returned Promise resolves with the operation result or rejects with its
error. A rejected operation still releases the lock, allowing the next
transaction to continue.

### `charon.runTx(id, transaction, options?)`

Acquires the ID's lock for a callback that may execute several serialized
operations. The callback receives a transaction-bound `run` function and the
shared abort signal.

```js
const result = await documents.runTx(documentId, async (run, signal) => {
    const document = await run(() => loadDocument(documentId, { signal }));

    const updated = await run(() => {
        signal.throwIfAborted();
        return applyChanges(document);
    });

    await run(() => saveDocument(updated, { signal }), {
        opMs: 10_000
    });

    return updated;
});
```

Operations submitted through `run` execute in order. The transaction retains
ownership between them. `runTx` always attempts to close the transaction,
including when the callback rejects.

The bound `run` can technically be called concurrently; the internal queue
still serializes the callbacks:

```js
await documents.runTx(documentId, async run => {
    const first = run(stepOne);
    const second = run(stepTwo);
    await Promise.all([first, second]); // stepTwo starts after stepOne settles
});
```

### Manual transactions

Prefer `runTx` unless ownership must outlive one callback. Manual transactions
must always close in a `finally` block.

```js
const { key, signal } = await documents.openTx(documentId, {
    totalMs: 30_000,
    idleMs: 2_000
});

try {
    const document = await documents.runInTx(
        documentId,
        key,
        () => loadDocument(documentId, { signal })
    );

    await documents.runInTx(
        documentId,
        key,
        () => saveDocument(document, { signal })
    );
} finally {
    await documents.closeTx(documentId, key);
}
```

Always `await closeTx()`. Closing waits for operations already queued in the
transaction before transferring ownership to the next waiter.

### `charon.openTx(id, options?)`

Waits until the ID is available, starts its timeout lifecycle, and resolves to:

```js
{
    key,     // opaque value created by generateKey
    signal   // shared AbortSignal for the transaction
}
```

### `charon.runInTx(id, key, operation, options?)`

Queues an operation in an existing transaction. Operations in that transaction
are serialized. Resolves to the callback result, or `false` when the ID or key
is invalid and throwing is disabled.

It does not create a missing lock or transaction.

### `charon.touchTx(id, key, options?)`

Restarts the idle timeout while an existing transaction is idle. Returns
`true` on success and `false` for an invalid, expired, or busy transaction when
throwing is disabled.

```js
if (!documents.touchTx(documentId, key)) {
    // Ownership was lost, the transaction expired, or it is currently busy.
}
```

Do not call `touchTx` during a running operation. Operation time is controlled
by `opMs`; `touchTx` is specifically an idle keep-alive.

### `charon.closeTx(id, key, options?)`

Stops timers, waits for queued operations, and releases ownership. Resolves to
`true` when the transaction closed. If the ID does not exist, it returns
`false` directly; using `await` handles both forms naturally.

### `charon.checkTx(id, key, options?)`

Returns whether `key` owns the ID's current live transaction. Returns `false`
for a missing ID or invalid key unless throwing is enabled.

### `charon.get(id, options?)`

Returns the currently managed `LockLimited`, or `undefined` if that ID has no
active lock. This method does not create a lock.

```js
const lock = documents.get(documentId);
```

With `{ throwError: true }`, a missing ID throws instead.

### `charon.has(id, options?)`

Returns whether Charon currently manages a lock for the ID. Like `get`, it does
not create one.

## Standalone locks

### `LockLimited`

Use `LockLimited` when only one resource needs protection but timeout handling
is still required. Its transaction API is the same as the corresponding
Charon methods, without the leading ID.

```js
const lock = new LockLimited({
    generateKey: () => Symbol("transaction"),
    opMs: 5_000,
    idleMs: 1_000,
    totalMs: 15_000
});

const value = await lock.run(async signal => {
    return performProtectedWork({ signal });
});

const transactionValue = await lock.runTx(async (run, signal) => {
    const first = await run(() => firstStep({ signal }));
    return run(() => secondStep(first, { signal }));
});
```

Important properties and methods:

- `state` is `"ready"`, `"idle"`, or `"busy"`.
- `size` is the number of transactions waiting to acquire the lock.
- `isState(state)` tests the current state.
- `run`, `runTx`, `openTx`, `runInTx`, `touchTx`, `checkTx`, and `closeTx`
  behave as described above.
- `cfg` exposes the normalized, frozen configuration.

### `LockUnlimited`

`LockUnlimited` provides the same exclusive transaction and serialized
operation model without timeout contexts or abort signals.

```js
const lock = new LockUnlimited({
    generateKey: () => Symbol("transaction")
});

await lock.run(async () => {
    await performProtectedWork();
});

await lock.runTx(async run => {
    const first = await run(firstStep);
    await run(() => secondStep(first));
});
```

`openTx()` resolves directly to the key rather than `{ key, signal }`.

```js
const key = await lock.openTx();

try {
    await lock.runInTx(key, operation);
} finally {
    await lock.closeTx(key);
}
```

When closing begins, the lock rejects new operations for that transaction and
waits for operations already in its queue.

### `LockGate`

`LockGate` is the ownership primitive below the operation locks. It does not
execute callbacks. It only grants keys, queues ownership requests, validates
the current key, and transfers ownership on close.

```js
const gate = new LockGate({
    generateKey: () => Symbol("owner")
});

const key = await gate.openTx();

try {
    if (gate.checkTx(key)) {
        // This caller still owns the gate.
    }
} finally {
    gate.closeTx(key); // synchronous for LockGate itself
}
```

For `LockGate`:

- `state` is a boolean indicating whether the gate is owned.
- `size` is the number of waiting owners.
- `openTx()` resolves to the generated key.
- `closeTx()` is synchronous and returns a boolean.

## SerialQueue

`SerialQueue` is independent of transaction ownership. It executes callbacks
one at a time in insertion order.

```js
const queue = new SerialQueue();

const first = queue.add(async () => {
    await writePartOne();
    return 1;
});

const second = queue.add(async () => {
    await writePartTwo();
    return 2;
});

console.log(await first);  // 1
console.log(await second); // 2
await queue.drain();
```

- `add(callback)` returns a Promise for that callback's result.
- `drain()` waits until the current queue becomes empty.
- `size` includes the running callback and queued callbacks.
- `idle` is `true` when `size === 0`.
- A rejected callback rejects its own Promise but does not block later work.

## State and return-value reference

### Lock states

| State | Meaning |
| --- | --- |
| `"ready"` | No transaction owns the lock. |
| `"idle"` | A transaction owns it, with no operation currently queued or running. |
| `"busy"` | The owning transaction has queued or running operations. |

### Invalid transaction behavior

| Method | Default result when invalid | With `throwError: true` |
| --- | --- | --- |
| `get` | `undefined` | Throws |
| `checkTx` | `false` | Throws |
| `touchTx` | `false` | Throws |
| `runInTx` | Promise resolving to `false` | Rejects |
| `closeTx` | `false` or Promise resolving to `false` | Throws or rejects |

High-level `run`, `runTx`, and `openTx` create or wait for valid ownership and
therefore do not use `false` as their normal result.

## Practical patterns

### Prevent duplicate writes for one entity

```js
const entities = new Charon({
    generateKey: () => Symbol(),
    opMs: 10_000
});

export const updateEntity = (id, patch) => entities.run(id, async signal => {
    const entity = await repository.get(id, { signal });
    Object.assign(entity, patch);
    await repository.save(entity, { signal });
    return entity;
});
```

Calls for one `id` serialize; unrelated entities are not globally blocked.

### Keep a transaction alive between externally driven steps

```js
const tx = await entities.openTx(id, { idleMs: 5_000 });

try {
    await waitForExternalStep();
    tx.signal.throwIfAborted();
    entities.touchTx(id, tx.key);

    await entities.runInTx(id, tx.key, signal => {
        return applyExternalStep({ signal });
    });
} finally {
    await entities.closeTx(id, tx.key);
}
```

For a lifecycle contained in one callback, `runTx` is simpler and safer.

### Observe abort without relying on a cancellable API

```js
const aborted = signal => {
    if (signal.aborted) { return Promise.resolve(signal.reason); }

    return new Promise(resolve => {
        signal.addEventListener(
            "abort",
            () => resolve(signal.reason),
            { once: true }
        );
    });
};

const reason = await locks.run("resource", signal => aborted(signal), {
    opMs: 100
});

console.log(reason.trigger); // "soft"
```

## Common mistakes

### Forgetting to close a manual transaction

An unclosed transaction retains ownership indefinitely unless a timeout and
`forceCloseMs` eventually release it. Always use `try/finally` and await close.

### Treating abort as forced termination

Abort is cooperative. Forward the signal to I/O APIs and check it during
long-running application code.

### Calling `touchTx` while busy

`touchTx` is an idle keep-alive. It returns `false` or throws while operations
are active. Configure or override `opMs` for active work.

### Using one global lock for unrelated resources

A standalone lock serializes everything sent to it. Use `Charon` when the work
has natural IDs and independent IDs should remain concurrent.

### Assuming `Charon.has(id)` means the resource exists

It only reports whether Charon currently manages an active lock for that ID.
It says nothing about the underlying database record, file, or remote object.

### Starting multi-ID transactions without a lock order

Charon coordinates each ID independently; it does not provide an atomic
multi-ID transaction primitive. Acquiring several IDs manually in inconsistent
orders can deadlock. If multiple-resource locking is necessary, define and
enforce one deterministic acquisition order at the application level.

## Runtime characteristics

- Work for one lock is FIFO.
- Different Charon IDs remain concurrent.
- Errors do not poison an operation queue.
- Completed Charon locks are removed when they have no waiter.
- No JavaScript callback is forcibly interrupted.
- The package has no background worker; progress happens through Promises and
  configured timers.

## License

MIT
