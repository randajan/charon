import assert from "assert/strict";
import Charon, {
    Charon as NamedCharon,
    LockGate,
    LockLimited,
    LockUnlimited,
    SerialQueue
} from "../../dist/esm/index.mjs";


const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const waitForAbort = (signal, timeoutMs = 200) => new Promise((resolve, reject) => {
    if (signal.aborted) { return resolve(signal.reason); }

    const timeout = setTimeout(() => {
        reject(new Error("LockLimited did not abort the transaction in time"));
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


await runDemo("1. SerialQueue runs asynchronous work in order", async () => {
    const queue = new SerialQueue();
    const events = [];

    const first = queue.add(async () => {
        events.push("first:start");
        await wait(20);
        events.push("first:end");
        return 1;
    });

    const second = queue.add(async () => {
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

    const failed = queue.add(() => { throw new Error("expected demo error"); });
    const afterFailure = queue.add(() => 3);

    await assert.rejects(failed, /expected demo error/);
    assert.equal(await afterFailure, 3, "a failed task must not block the queue");
    await queue.drain();
    assert.equal(queue.idle, true);
});


await runDemo("2. LockGate hands ownership to the next transaction", async () => {
    const lock = new LockGate({ generateKey: createKeyGenerator("gate") });

    const firstKey = await lock.openTx();
    const secondKeyPromise = lock.openTx();

    assert.equal(firstKey, "gate-1");
    assert.equal(lock.state, true);
    assert.equal(lock.size, 1, "the second transaction should be waiting");
    assert.equal(lock.closeTx("unknown"), false);
    assert.throws(
        () => lock.closeTx("unknown", { throwError: true }),
        /unknown/
    );

    assert.equal(lock.closeTx(firstKey), true);

    const secondKey = await secondKeyPromise;
    assert.equal(secondKey, "gate-2");
    assert.equal(lock.size, 0);
    assert.equal(lock.closeTx(secondKey), true);
    assert.equal(lock.state, false);
});


await runDemo("3. LockUnlimited serializes complete transactions", async () => {
    const lock = new LockUnlimited({ generateKey: createKeyGenerator("unlimited") });
    const events = [];

    const first = lock.run(async () => {
        events.push("first:start");
        await wait(20);
        events.push("first:end");
        return "first result";
    });

    const second = lock.run(async () => {
        events.push("second:start");
        await wait(5);
        events.push("second:end");
        return "second result";
    });

    assert.deepEqual(await Promise.all([first, second]), [
        "first result",
        "second result"
    ]);
    assert.deepEqual(events, [
        "first:start",
        "first:end",
        "second:start",
        "second:end"
    ]);
    assert.equal(lock.state, "ready");
});


await runDemo("4. LockLimited aborts an operation after its timeout", async () => {
    const lock = new LockLimited({
        generateKey: createKeyGenerator("limited"),
        opMs: 20,
        unref: false
    });

    const reason = await lock.run(signal => waitForAbort(signal));

    assert.equal(reason.trigger, "soft");
    assert.deepEqual(reason.log, ["op"]);
    assert.equal(lock.state, "ready");
});


await runDemo("5. Charon serializes each id independently", async () => {
    assert.equal(Charon, NamedCharon, "default and named exports should match");

    const closed = [];
    const locks = new Charon({
        generateKey: createKeyGenerator("charon"),
        onClose: (_charon, event) => closed.push({
            id: event.id,
            hasNext: event.hasNext
        })
    });
    const events = [];

    const accountA1 = locks.run("account-a", async () => {
        events.push("a1:start");
        await wait(25);
        events.push("a1:end");
        return "a1";
    });

    const accountA2 = locks.run("account-a", async () => {
        events.push("a2:start");
        await wait(5);
        events.push("a2:end");
        return "a2";
    });

    const accountB = locks.run("account-b", async () => {
        events.push("b:start");
        await wait(5);
        events.push("b:end");
        return "b";
    });

    assert.deepEqual(await Promise.all([accountA1, accountA2, accountB]), [
        "a1",
        "a2",
        "b"
    ]);

    assert.ok(
        events.indexOf("a2:start") > events.indexOf("a1:end"),
        "operations using the same id must be serialized"
    );
    assert.ok(
        events.indexOf("b:end") < events.indexOf("a1:end"),
        "operations using different ids should run independently"
    );
    assert.equal(locks.size, 0, "finished locks should be removed from Charon");
    assert.ok(closed.some(event => event.id === "account-a"));
    assert.ok(closed.some(event => event.id === "account-b"));
});


await runDemo("6. Explicit transaction serializes its operations", async () => {
    const lock = new LockLimited({
        generateKey: createKeyGenerator("explicit")
    });
    const { key, signal } = await lock.openTx();
    const events = [];

    const first = lock.runInTx(key, async operationSignal => {
        assert.equal(operationSignal, signal);
        events.push("first:start");
        await wait(20);
        events.push("first:end");
        return 1;
    });

    const second = lock.runInTx(key, async () => {
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
    assert.equal(await lock.closeTx(key), true);
    assert.equal(lock.state, "ready");
});


await runDemo("7. Idle transaction is aborted after idleMs", async () => {
    const lock = new LockLimited({
        generateKey: createKeyGenerator("idle"),
        idleMs: 20,
        unref: false
    });
    const { key, signal } = await lock.openTx();
    const reason = await waitForAbort(signal);

    assert.equal(reason.trigger, "soft");
    assert.deepEqual(reason.log, ["idle"]);
    assert.equal(await lock.closeTx(key), true);
});


await runDemo("8. totalMs remains a hard deadline after touches", async () => {
    const lock = new LockLimited({
        generateKey: createKeyGenerator("total"),
        totalMs: 50,
        idleMs: 25,
        unref: false
    });
    const { key, signal } = await lock.openTx();

    await wait(15);
    assert.equal(lock.touchTx(key), true);
    await wait(15);
    assert.equal(lock.touchTx(key), true);
    await wait(15);
    assert.equal(lock.touchTx(key), true);

    const reason = await waitForAbort(signal);
    assert.equal(reason.trigger, "hard");
    assert.deepEqual(reason.log, ["idle", "touch", "touch", "touch"]);
    assert.equal(await lock.closeTx(key), true);
});


await runDemo("9. forceCloseMs releases an abandoned transaction", async () => {
    const closed = [];
    const lock = new LockLimited({
        generateKey: createKeyGenerator("forced"),
        idleMs: 15,
        forceCloseMs: 15,
        unref: false,
        onClose: (_lock, hasNext) => closed.push(hasNext)
    });
    const { key, signal } = await lock.openTx();

    await waitForAbort(signal);
    await waitUntil(() => lock.state === "ready");

    assert.equal(lock.checkTx(key), false);
    assert.deepEqual(closed, [false]);
});


await runDemo("10. A rejected operation still releases the lock", async () => {
    const lock = new LockLimited({
        generateKey: createKeyGenerator("error")
    });

    await assert.rejects(
        lock.run(async () => { throw new Error("operation failed"); }),
        /operation failed/
    );

    assert.equal(lock.state, "ready");
    assert.equal(await lock.run(async () => "recovered"), "recovered");
    assert.equal(lock.state, "ready");
});


console.log("\nCharon demo completed successfully.");

