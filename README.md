# @randajan/bounce

[![NPM](https://img.shields.io/npm/v/@randajan/bounce.svg)](https://www.npmjs.com/package/@randajan/bounce) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)


Tiny JavaScript library for collecting many small tasks and processing them as a single batch.

`@randajan/bounce` is a generalized successor to [`@randajan/queue`](https://www.npmjs.com/package/@randajan/queue). The original package exposed a callable queue focused on batching function calls. Bounce opens that mechanism up as a small stateful primitive: tasks can be values of any type, the pending batch can be inspected, and its execution can be controlled explicitly.

The package is useful when work arrives more frequently than it should be performed—for example, when grouping database writes, sending changes to an API, rebuilding an index, collecting telemetry, or coalescing repeated invalidations.

## Installation

```sh
npm install @randajan/bounce
```

## Quick start

```js
import createBounce from "@randajan/bounce";

const changes = createBounce(async (tasks, trigger) => {
    console.log(`Sending ${tasks.length} changes because of: ${trigger}`);
    await sendChangesToApi(tasks);
    return tasks.length;
}, {
    softMs: 200,
    hardMs: 2_000,
    maxSize: 100,
    unref: false
});

const firstBatch = changes.attach({ id: 1, value: "a" });
const sameBatch = changes.attach({ id: 2, value: "b" });

console.log(firstBatch === sameBatch); // true
console.log(await firstBatch);         // 2
```

Every task attached while a batch is pending receives the same Promise. That Promise resolves with the return value of the batch processor, or rejects when the processor fails.

## How a batch works

A `Bounce` instance has at most one pending batch:

1. The first call to `attach()` creates a batch and calls `onInit`.
2. Further calls append tasks to that batch in insertion order.
3. A configured soft timeout is restarted after every attached task.
4. A hard timeout, if configured, continues counting from the first task.
5. Reaching `maxSize`, reaching either timeout, or calling `execute()` detaches the batch and invokes the processor.
6. All callers attached to that batch receive the same processor result.

The batch is removed from the instance before its processor runs. This means another batch can begin while a previous one is still being processed. `state`, `size`, `result`, and the timestamp properties describe only the currently pending batch, not processors that are already running.

If no timeout and no `maxSize` are configured, a batch remains pending until `execute()` or `flush()` is called.

## API

The package exports `createBounce` as both its default export and a named export. The `Bounce` class is also exported for construction and `instanceof` checks.

```js
import createBounce, {
    Bounce,
    createBounce as createNamedBounce
} from "@randajan/bounce";
```

### `createBounce(processTasks, options?)`

Creates and returns a `Bounce` instance.

```js
const bounce = createBounce(processTasks, options);
```

This is equivalent to:

```js
const bounce = new Bounce(processTasks, options);
```

### `processTasks(tasks, trigger)`

The required processor is called once for each executed batch.

```js
const bounce = createBounce(async (tasks, trigger) => {
    // tasks: all values attached to this batch, in insertion order
    // trigger: "soft" | "hard" | "size" | "manual"
    return processBatch(tasks);
});
```

The processor may return a value or a Promise. Its final value becomes the result shared by calls to `attach()` and `execute()`. A thrown error or rejected Promise rejects that shared result.

The `trigger` explains why processing began:

| Trigger | Meaning |
| --- | --- |
| `"soft"` | No new task arrived before the soft timeout expired. |
| `"hard"` | The maximum lifetime of the batch expired. |
| `"size"` | The batch reached `maxSize`. |
| `"manual"` | `execute()` was called. `flush()` also reports `"manual"` to `onEnd`, although it does not call the processor. |

### Options

```js
const bounce = createBounce(processTasks, {
    softMs: 200,
    hardMs: 2_000,
    minSize: 2,
    maxSize: 100,
    unref: true,
    onInit() {},
    onEnd(trigger, result) {}
});
```

#### `softMs`

Time in milliseconds to wait after the most recently attached task. Attaching another task restarts this timer. When it expires, the batch executes with the `"soft"` trigger.

Omit it or use `0` to disable the default soft timeout. A particular call to `attach(task, softMs)` can override it for the current wait.

#### `hardMs`

Maximum lifetime of a batch in milliseconds, measured from its first task. Unlike the soft timeout, attaching more tasks does not restart it. When it expires, the batch executes with the `"hard"` trigger.

Omit it or use `0` to disable the hard timeout.

Timeouts must be finite, non-negative numbers no greater than `2 ** 31 - 1`.

#### `maxSize`

Executes a batch immediately when its number of tasks reaches this positive integer. The processor receives the `"size"` trigger.

Omit this option to disable the size limit.

#### `minSize`

Requires at least this many tasks before calling the processor. If execution is triggered with a smaller batch, the batch is discarded and its shared Promise resolves with `undefined`.

`onEnd` is still called for a discarded batch with the trigger that attempted the execution. Omit this option when every non-empty batch should be processed.

Both `minSize` and `maxSize`, when supplied, must be positive integers. Be careful not to set `maxSize` below `minSize`, because every size-triggered batch would then be discarded.

#### `unref`

Defaults to `true`. In runtimes such as Node.js, Bounce calls `unref()` on its timers when that method is available. A pending batch therefore does not keep an otherwise idle process alive.

Use `unref: false` when a short-lived process must remain alive until a timer executes the pending batch:

```js
const bounce = createBounce(writeBatch, {
    softMs: 100,
    unref: false
});

await bounce.attach(change);
```

This option has no effect in runtimes whose timer handles do not support `unref()`.

#### `onInit()`

Called synchronously after the first task initializes a new batch. Its return value is ignored. A synchronous error thrown by this callback is ignored and does not affect the batch. The callback should perform synchronous notification only; a Promise returned by it is not observed.

#### `onEnd(trigger, result)`

Called after a batch is processed, discarded by `minSize`, or cleared by `flush()`.

The second argument is the already-settled Promise shared by the batch, not its unwrapped value. This allows the callback to observe either the result or the processor error:

```js
const bounce = createBounce(processBatch, {
    onEnd(trigger, result) {
        result.then(
            value => console.log("Completed", trigger, value),
            error => console.error("Failed", trigger, error)
        );
    }
});
```

The callback's return value is not awaited. A synchronous error thrown by it is ignored, so lifecycle callbacks do not change the batch result. If `onEnd` is asynchronous, it should handle its own rejected Promise.

## Instance methods

### `bounce.attach(task, softMs?)`

Adds one task to the pending batch and returns that batch's Promise.

```js
const result = await bounce.attach(task);
```

The optional second argument overrides `options.softMs` after this attachment. Passing `0` disables the soft timer for the current wait. A later attachment may schedule it again.

If adding the task reaches `maxSize`, processing starts immediately and the returned Promise represents that execution.

All `attach()` calls belonging to one batch return the exact same Promise:

```js
const a = bounce.attach("a");
const b = bounce.attach("b");

console.log(a === b); // true
```

### `bounce.execute()`

Immediately executes the pending batch with the `"manual"` trigger and returns its shared Promise.

```js
const result = await bounce.execute();
```

If no batch is pending, it returns a Promise resolved with `undefined`. Calling `execute()` does not wait for processors from older, already detached batches.

### `bounce.flush()`

Discards the pending batch without calling `processTasks`, cancels its timers, and resolves its shared Promise with `undefined`.

```js
await bounce.flush();
```

`onEnd` is called with the `"manual"` trigger for a flushed batch. If no batch is pending, `flush()` simply returns a Promise resolved with `undefined` and does not call `onEnd`.

`flush()` affects only the pending batch. It cannot cancel a processor that has already started.

## Instance state

All state properties are read-only.

| Property | Type | Description |
| --- | --- | --- |
| `state` | `boolean` | `true` while a batch is pending. |
| `size` | `number` | Number of tasks in the pending batch; otherwise `0`. |
| `result` | `Promise \| undefined` | Shared Promise of the pending batch. |
| `startAt` | `number \| undefined` | Unix timestamp in milliseconds when the first task was attached. |
| `touchAt` | `number \| undefined` | Unix timestamp in milliseconds when the most recent task was attached. |
| `softEndAt` | `number \| undefined` | Scheduled soft-timeout timestamp, if active. |
| `hardEndAt` | `number \| undefined` | Scheduled hard-timeout timestamp, if active. |

The properties reset as soon as a batch is executed or flushed. In particular, `state` becomes `false` before `processTasks` finishes.

## Execution examples

### Debounce bursts of work

The soft timeout waits until activity becomes quiet:

```js
const updates = createBounce(saveUpdates, { softMs: 250 });

updates.attach({ id: 1, name: "A" });
updates.attach({ id: 2, name: "B" });
updates.attach({ id: 3, name: "C" });
```

Assuming the calls occur within 250 ms of each other, `saveUpdates` runs once with all three objects.

### Combine soft and hard limits

A continuous stream of tasks can keep restarting the soft timer forever. Add `hardMs` to guarantee an upper bound:

```js
const events = createBounce(sendEvents, {
    softMs: 500,
    hardMs: 5_000
});
```

The batch executes after 500 ms of inactivity, but never later than 5 seconds after its first event.

### Execute full batches immediately

```js
const rows = createBounce(insertRows, {
    softMs: 1_000,
    maxSize: 500
});
```

The processor runs either when 500 rows have accumulated or when the stream has been quiet for one second.

### Drop insignificant batches

```js
const metrics = createBounce(sendMetrics, {
    softMs: 10_000,
    hardMs: 60_000,
    minSize: 10
});
```

When a timeout fires with fewer than ten metrics, the batch is discarded and its Promise resolves with `undefined`.

### Manually controlled batches

```js
const transaction = createBounce(commitChanges);

transaction.attach(changeA);
transaction.attach(changeB);

const count = await transaction.execute();
```

Without automatic triggers, the caller decides when to process or discard the batch.

## Promise and error behavior

- A processor value resolves the shared batch Promise with that value.
- A processor Promise is awaited automatically.
- A thrown processor error or rejected processor Promise rejects the shared batch Promise.
- `minSize` discards resolve with `undefined`.
- `flush()` resolves the discarded batch with `undefined`.
- Empty calls to `execute()` and `flush()` resolve with `undefined`.
- Starting a newer batch does not alter the Promise of an older batch.
- Lifecycle callback return values never replace the processor result.

Because `undefined` is also a valid processor return value, callers cannot distinguish an explicit `undefined` result from a discarded batch using the resolved value alone. Use an application-level result value, or avoid `minSize` and `flush()` when that distinction matters.

## Migration from `@randajan/queue`

Bounce preserves the central idea of `@randajan/queue`—collect frequent calls and process them together—but deliberately exposes the batching core instead of returning a specialized callable function.

The primary migration is:

```js
// @randajan/queue
const pushTask = createQueue(processQueue, {
    ...options,
    returnResult: true
});
const result = await pushTask(task);

// @randajan/bounce
const bounce = createBounce(processTasks, options);
const result = await bounce.attach(task);
```

Important conceptual differences:

- The returned value is a `Bounce` object, not a function.
- Tasks are attached explicitly with `attach()`.
- The processor always receives `(tasks, trigger)`.
- Processor results are always represented by the shared batch Promise; there is no `returnResult` mode.
- The pending batch can be inspected through `state`, `size`, `result`, and timestamps.
- `execute()` processes a batch, while `flush()` discards it.
- Options that transformed or forwarded queue call arguments (`args`, `pass`, and similar queue-specific behavior) are no longer part of the core. Perform any desired mapping before `attach()` or inside `processTasks()`.

This smaller abstraction makes Bounce useful beyond function-call queues while keeping batching policy separate from task-specific behavior.

## TypeScript

The package includes TypeScript declarations. Task and result types flow through the processor into the instance:

```ts
import createBounce from "@randajan/bounce";

interface Change {
    id: number;
    value: string;
}

const changes = createBounce(
    async (tasks: Change[], trigger): Promise<number> => {
        await sendChangesToApi(tasks);
        return tasks.length;
    },
    { softMs: 200 }
);

const result: number | undefined = await changes.attach({
    id: 1,
    value: "updated"
});
```

The resolved type includes `undefined` because a pending batch may be flushed or discarded by `minSize`.

## License

MIT © [randajan](https://github.com/randajan)
