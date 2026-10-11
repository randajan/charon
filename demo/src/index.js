import { info } from "@randajan/simple-lib/node";

import assert from "assert/strict";
import Charon, {
    Charon as NamedCharon,
    Lock,
    Observer,
    PromiseQueue,
} from "../../dist/esm/index.mjs";

import TimeoutObserver from "../../dist/esm/obs/timed/index.mjs";



const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const waitForAbort = (signal, timeoutMs = 200) => new Promise((resolve, reject) => {
    if (signal.aborted) { return resolve(signal.reason); }

    const timeout = setTimeout(() => {
        reject(new Error("Transaction did not abort in time"));
    }, timeoutMs);

    signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        resolve(signal.reason);
    }, { once: true });
});

const waitUntil = async (predicate, timeoutMs = 200) => {
    const expiresAt = Date.now() + timeoutMs;
    while (!predicate()) {
        if (Date.now() >= expiresAt) {
            throw new Error("Condition was not met in time");
        }
        await wait(5);
    }
};

const createKeyGenerator = (prefix = "tx") => {
    let id = 0;
    return () => `${prefix}-${++id}`;
};

const runDemo = async (label, callback) => {
    process.stdout.write(`\n${label}\n`);
    await callback();
    console.log("  ✓ all checks passed");
};

const assertLog = (log, expected) => {
    assert.deepEqual(
        log.map(({ status, ms }) => ({ status, ms })),
        expected
    );
    assert.ok(log.every(({ ts }) => Number.isFinite(ts)));
};


await runDemo("1. PromiseQueue runs asynchronous work in order", async () => {
    const queue = new PromiseQueue();
    const events = [];

    const first = queue.run(async () => {
        events.push("first:start");
        await wait(20);
        events.push("first:end");
        return 1;
    });

    const second = queue.run(async () => {
        events.push("second:start");
        await wait(5);
        events.push("second:end");
        return 2;
    });

    assert.equal(queue.size, 2);
    assert.deepEqual(await Promise.all([first, second]), [1, 2]);
    assert.deepEqual(events, [
        "first:start",
        "first:end",
        "second:start",
        "second:end"
    ]);
    await queue.drain();
    assert.equal(queue.state, "idle");
});


await runDemo("2. Lock serializes complete transactions", async () => {
    const lock = new Lock({
        generateKey: createKeyGenerator("lock"),
        observer: new Observer()
    });
    const events = [];

    const first = lock.run(async () => {
        events.push("first:start");
        await wait(20);
        events.push("first:end");
        return "first";
    });

    const second = lock.run(async () => {
        events.push("second:start");
        await wait(5);
        events.push("second:end");
        return "second";
    });

    assert.deepEqual(await Promise.all([first, second]), ["first", "second"]);
    assert.deepEqual(events, [
        "first:start",
        "first:end",
        "second:start",
        "second:end"
    ]);
    assert.equal(lock.state, "ready");
});


await runDemo("3. SingleTimeoutContext aborts one operation", async () => {
    const lock = new Lock({
        generateKey: createKeyGenerator("single"),
        observer: new TimeoutObserver({ opMs: 20, unref: false })
    });

    const reason = await lock.run(tx => waitForAbort(tx.signal));

    assert.equal(reason.code, "op");
    assert.equal(reason.ms, 20);
    assertLog(reason.log, [{ status: "op", ms: 20 }]);
    assert.equal(lock.state, "ready");
});


await runDemo("4. MultiTimeoutContext serializes transaction operations", async () => {
    const lock = new Lock({
        generateKey: createKeyGenerator("multi"),
        observer: new TimeoutObserver()
    });
    const tx = await lock.openTx();
    const events = [];

    const first = tx.run(async () => {
        events.push("first:start");
        await wait(20);
        events.push("first:end");
        return 1;
    });

    const second = tx.run(async () => {
        events.push("second:start");
        events.push("second:end");
        return 2;
    });

    assert.deepEqual(await Promise.all([first, second]), [1, 2]);
    assert.deepEqual(events, [
        "first:start",
        "first:end",
        "second:start",
        "second:end"
    ]);
    assert.equal(await tx.close(), true);
    assert.equal(lock.state, "ready");
});


await runDemo("5. MultiTimeoutContext aborts an idle transaction", async () => {
    const lock = new Lock({
        generateKey: createKeyGenerator("idle"),
        observer: new TimeoutObserver({ idleMs: 20, unref: false })
    });
    const tx = await lock.openTx();
    const reason = await waitForAbort(tx.signal);

    assert.equal(reason.code, "idle");
    assert.equal(reason.ms, 20);
    assertLog(reason.log, [{ status: "idle", ms: 20 }]);
    assert.equal(await tx.close(), true);
});


await runDemo("6. totalMs remains a hard deadline after touches", async () => {
    const lock = new Lock({
        generateKey: createKeyGenerator("total"),
        observer: new TimeoutObserver({
            totalMs: 50,
            idleMs: 25,
            unref: false
        })
    });
    const tx = await lock.openTx();

    await wait(15);
    assert.equal(tx.touch(), true);
    await wait(15);
    assert.equal(tx.touch(), true);
    await wait(15);
    assert.equal(tx.touch(), true);

    const reason = await waitForAbort(tx.signal);
    assert.equal(reason.code, "total");
    assert.equal(reason.ms, 50);
    assertLog(reason.log, [
        { status: "idle", ms: 25 },
        { status: "touch", ms: 25 },
        { status: "touch", ms: 25 },
        { status: "touch", ms: 25 }
    ]);
    assert.equal(await tx.close(), true);
});


await runDemo("7. forceCloseMs releases an abandoned transaction", async () => {
    const closed = [];
    const lock = new Lock({
        generateKey: createKeyGenerator("forced"),
        observer: new TimeoutObserver({
            idleMs: 15,
            forceCloseMs: 15,
            unref: false
        }),
        onClose: (_lock, hasNext) => closed.push(hasNext)
    });
    const tx = await lock.openTx();

    await waitForAbort(tx.signal);
    await waitUntil(() => lock.state === "ready");

    assert.equal(lock.getTx(tx.key), undefined);
    assert.deepEqual(closed, [false]);
});


await runDemo("8. Manual abort preserves its activity log", async () => {
    const lock = new Lock({
        generateKey: createKeyGenerator("manual"),
        observer: new TimeoutObserver()
    });
    const tx = await lock.openTx();

    assert.equal(tx.abort(), true);
    assert.equal(tx.signal.reason.code, "manual");
    assertLog(tx.signal.reason.log, [{ status: "idle", ms: undefined }]);
    assert.equal(await tx.run(async () => "must not run"), false);
    assert.equal(tx.touch(), false);
    assert.equal(tx.abort(), false);
    assert.equal(await tx.close(), true);
    assert.equal(lock.state, "ready");
});


await runDemo("9. Operation options override observer defaults", async () => {
    const lock = new Lock({
        generateKey: createKeyGenerator("override"),
        observer: new TimeoutObserver({ opMs: 100, unref: false })
    });
    const tx = await lock.openTx();

    const reason = await tx.run(
        currentTx => waitForAbort(currentTx.signal),
        { opMs: 20 }
    );

    assert.equal(reason.code, "op");
    assert.equal(reason.ms, 20);
    assertLog(reason.log, [
        { status: "idle", ms: undefined },
        { status: "op", ms: 20 }
    ]);
    assert.equal(await tx.close(), true);
});


await runDemo("10. Manual abort preserves a custom Error", async () => {
    const lock = new Lock({
        generateKey: createKeyGenerator("custom-abort"),
        observer: new TimeoutObserver()
    });
    const tx = await lock.openTx();
    const reason = new Error("cancelled by owner");

    let releaseOperation;
    let markOperationStarted;
    const operationBlocker = new Promise(resolve => { releaseOperation = resolve; });
    const operationStarted = new Promise(resolve => { markOperationStarted = resolve; });

    const running = tx.run(async () => {
        markOperationStarted();
        await operationBlocker;
        return "finished";
    });

    await operationStarted;
    const aborted = waitForAbort(tx.signal);

    assert.equal(tx.abort(reason), true);
    assert.equal(await aborted, reason);
    assert.equal(tx.signal.reason, reason);
    assert.equal(await tx.run(async () => "must not run"), false);

    releaseOperation();
    assert.equal(await running, "finished");
    assert.equal(await tx.close(), true);
    assert.equal(lock.state, "ready");
});


await runDemo("11. abortAll aborts active and pending transactions", async () => {
    const lock = new Lock({
        generateKey: createKeyGenerator("abort-all"),
        observer: new TimeoutObserver()
    });
    const active = await lock.openTx();
    const pendingA = lock.openTx().then(
        () => undefined,
        reason => reason
    );
    const pendingB = lock.openTx().then(
        () => undefined,
        reason => reason
    );
    const reason = new Error("lock shutdown");
    const aborted = waitForAbort(active.signal);

    assert.equal(lock.size, 2);
    assert.equal(lock.abortAll(reason), 2);
    assert.equal(await aborted, reason);
    assert.equal(active.signal.reason, reason);
    assert.equal(await pendingA, reason);
    assert.equal(await pendingB, reason);
    assert.equal(lock.size, 0);
    assert.equal(await active.run(async () => "must not run"), false);

    assert.equal(await active.close(), true);
    assert.equal(lock.state, "ready");
});


await runDemo("12. kill manually releases a lock with a stuck operation", async () => {
    const lock = new Lock({
        generateKey: createKeyGenerator("manual-kill"),
        observer: new TimeoutObserver()
    });
    const stuckTx = await lock.openTx();

    let markOperationStarted;
    const operationStarted = new Promise(resolve => { markOperationStarted = resolve; });

    stuckTx.run(async () => {
        markOperationStarted();
        await new Promise(() => {});
    });

    await operationStarted;
    const nextTxPromise = lock.openTx();

    assert.equal(stuckTx.kill(), false, "kill must fail before abort and close");
    assert.equal(stuckTx.abort(new Error("manual kill")), true);
    assert.equal(stuckTx.kill(), false, "kill must fail before close");

    const closing = stuckTx.close();
    await waitUntil(() => stuckTx.state === "closing");

    assert.equal(stuckTx.kill(), true);
    assert.equal(stuckTx.state, "destroyed");

    const nextTx = await nextTxPromise;
    assert.notEqual(nextTx.key, stuckTx.key);
    assert.equal(lock.getTx(nextTx.key), nextTx);
    assert.equal(await nextTx.close(), true);
    assert.equal(lock.state, "ready");

    void closing;
});


await runDemo("13. forceKillMs automatically releases a lock with a stuck operation", async () => {
    const lock = new Lock({
        generateKey: createKeyGenerator("automatic-kill"),
        observer: new TimeoutObserver({
            opMs: 15,
            forceCloseMs: 15,
            forceKillMs: 15,
            unref: false
        })
    });
    const stuckTx = await lock.openTx();

    let markOperationStarted;
    const operationStarted = new Promise(resolve => { markOperationStarted = resolve; });

    stuckTx.run(async () => {
        markOperationStarted();
        await new Promise(() => {});
    });

    await operationStarted;
    const nextTxPromise = lock.openTx();
    const reason = await waitForAbort(stuckTx.signal);

    assert.equal(reason.code, "op");
    await waitUntil(() => stuckTx.state === "destroyed");

    const nextTx = await nextTxPromise;
    assert.notEqual(nextTx.key, stuckTx.key);
    assert.equal(lock.getTx(nextTx.key), nextTx);
    assert.equal(await nextTx.close(), true);
    assert.equal(lock.state, "ready");
});


await runDemo("14. Charon manages an independent Lock for each id", async () => {
    assert.equal(Charon, NamedCharon);

    const locks = new Charon({
        generateKey: createKeyGenerator("charon"),
        observer: new TimeoutObserver(),
        retainMs: 20
    });
    const events = [];
    const accountA = locks.ensure("account-a");
    const accountB = locks.ensure("account-b");

    const accountA1 = accountA.run(async () => {
        events.push("a1:start");
        await wait(25);
        events.push("a1:end");
        return "a1";
    });

    const accountA2 = accountA.run(async () => {
        events.push("a2:start");
        events.push("a2:end");
        return "a2";
    });

    const accountBResult = accountB.run(async () => {
        events.push("b:start");
        await wait(5);
        events.push("b:end");
        return "b";
    });

    assert.deepEqual(await Promise.all([accountA1, accountA2, accountBResult]), [
        "a1",
        "a2",
        "b"
    ]);
    assert.ok(events.indexOf("a2:start") > events.indexOf("a1:end"));
    assert.ok(events.indexOf("b:end") < events.indexOf("a1:end"));
    await waitUntil(() => locks.size === 0);
});


console.log("\nCharon demo completed successfully.");
