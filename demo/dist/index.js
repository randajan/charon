// <define:__slib_info>
var define_slib_info_default = { isBuild: true, name: "@randajan/charon", description: "Lightweight asynchronous locks and keyed transaction queues for JavaScript", version: "2.0.0", author: { name: "Jan Randa", email: "jnranda@gmail.com", url: "https://www.linkedin.com/in/randajan/" }, env: "development", mode: "node", port: 3e3, dir: { root: "/home/randajan/dev/lib/charon", dist: "demo/dist" } };

// node_modules/chalk/source/vendor/ansi-styles/index.js
var ANSI_BACKGROUND_OFFSET = 10;
var wrapAnsi16 = (offset = 0) => (code) => `\x1B[${code + offset}m`;
var wrapAnsi256 = (offset = 0) => (code) => `\x1B[${38 + offset};5;${code}m`;
var wrapAnsi16m = (offset = 0) => (red, green, blue) => `\x1B[${38 + offset};2;${red};${green};${blue}m`;
var styles = {
  modifier: {
    reset: [0, 0],
    // 21 isn't widely supported and 22 does the same thing
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29]
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    // Bright color
    blackBright: [90, 39],
    gray: [90, 39],
    // Alias of `blackBright`
    grey: [90, 39],
    // Alias of `blackBright`
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39]
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    // Bright color
    bgBlackBright: [100, 49],
    bgGray: [100, 49],
    // Alias of `bgBlackBright`
    bgGrey: [100, 49],
    // Alias of `bgBlackBright`
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49]
  }
};
var modifierNames = Object.keys(styles.modifier);
var foregroundColorNames = Object.keys(styles.color);
var backgroundColorNames = Object.keys(styles.bgColor);
var colorNames = [...foregroundColorNames, ...backgroundColorNames];
function assembleStyles() {
  const codes = /* @__PURE__ */ new Map();
  for (const [groupName, group] of Object.entries(styles)) {
    for (const [styleName, style] of Object.entries(group)) {
      styles[styleName] = {
        open: `\x1B[${style[0]}m`,
        close: `\x1B[${style[1]}m`
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }
    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false
    });
  }
  Object.defineProperty(styles, "codes", {
    value: codes,
    enumerable: false
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  styles.color.ansi = wrapAnsi16();
  styles.color.ansi256 = wrapAnsi256();
  styles.color.ansi16m = wrapAnsi16m();
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
  Object.defineProperties(styles, {
    rgbToAnsi256: {
      value(red, green, blue) {
        if (red === green && green === blue) {
          if (red < 8) {
            return 16;
          }
          if (red > 248) {
            return 231;
          }
          return Math.round((red - 8) / 247 * 24) + 232;
        }
        return 16 + 36 * Math.round(red / 255 * 5) + 6 * Math.round(green / 255 * 5) + Math.round(blue / 255 * 5);
      },
      enumerable: false
    },
    hexToRgb: {
      value(hex) {
        const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
        if (!matches) {
          return [0, 0, 0];
        }
        let [colorString] = matches;
        if (colorString.length === 3) {
          colorString = [...colorString].map((character) => character + character).join("");
        }
        const integer = Number.parseInt(colorString, 16);
        return [
          /* eslint-disable no-bitwise */
          integer >> 16 & 255,
          integer >> 8 & 255,
          integer & 255
          /* eslint-enable no-bitwise */
        ];
      },
      enumerable: false
    },
    hexToAnsi256: {
      value: (hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)),
      enumerable: false
    },
    ansi256ToAnsi: {
      value(code) {
        if (code < 8) {
          return 30 + code;
        }
        if (code < 16) {
          return 90 + (code - 8);
        }
        let red;
        let green;
        let blue;
        if (code >= 232) {
          red = ((code - 232) * 10 + 8) / 255;
          green = red;
          blue = red;
        } else {
          code -= 16;
          const remainder = code % 36;
          red = Math.floor(code / 36) / 5;
          green = Math.floor(remainder / 6) / 5;
          blue = remainder % 6 / 5;
        }
        const value = Math.max(red, green, blue) * 2;
        if (value === 0) {
          return 30;
        }
        let result = 30 + (Math.round(blue) << 2 | Math.round(green) << 1 | Math.round(red));
        if (value === 2) {
          result += 60;
        }
        return result;
      },
      enumerable: false
    },
    rgbToAnsi: {
      value: (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
      enumerable: false
    },
    hexToAnsi: {
      value: (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
      enumerable: false
    }
  });
  return styles;
}
var ansiStyles = assembleStyles();
var ansi_styles_default = ansiStyles;

// node_modules/chalk/source/vendor/supports-color/browser.js
var level = (() => {
  if (!("navigator" in globalThis)) {
    return 0;
  }
  if (globalThis.navigator.userAgentData) {
    const brand = navigator.userAgentData.brands.find(({ brand: brand2 }) => brand2 === "Chromium");
    if (brand && brand.version > 93) {
      return 3;
    }
  }
  if (/\b(Chrome|Chromium)\//.test(globalThis.navigator.userAgent)) {
    return 1;
  }
  return 0;
})();
var colorSupport = level !== 0 && {
  level,
  hasBasic: true,
  has256: level >= 2,
  has16m: level >= 3
};
var supportsColor = {
  stdout: colorSupport,
  stderr: colorSupport
};
var browser_default = supportsColor;

// node_modules/chalk/source/utilities.js
function stringReplaceAll(string, substring, replacer) {
  let index = string.indexOf(substring);
  if (index === -1) {
    return string;
  }
  const substringLength = substring.length;
  let endIndex = 0;
  let returnValue = "";
  do {
    returnValue += string.slice(endIndex, index) + substring + replacer;
    endIndex = index + substringLength;
    index = string.indexOf(substring, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
  let endIndex = 0;
  let returnValue = "";
  do {
    const gotCR = string[index - 1] === "\r";
    returnValue += string.slice(endIndex, gotCR ? index - 1 : index) + prefix + (gotCR ? "\r\n" : "\n") + postfix;
    endIndex = index + 1;
    index = string.indexOf("\n", endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}

// node_modules/chalk/source/index.js
var { stdout: stdoutColor, stderr: stderrColor } = browser_default;
var GENERATOR = /* @__PURE__ */ Symbol("GENERATOR");
var STYLER = /* @__PURE__ */ Symbol("STYLER");
var IS_EMPTY = /* @__PURE__ */ Symbol("IS_EMPTY");
var levelMapping = [
  "ansi",
  "ansi",
  "ansi256",
  "ansi16m"
];
var styles2 = /* @__PURE__ */ Object.create(null);
var applyOptions = (object, options = {}) => {
  if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === void 0 ? colorLevel : options.level;
};
var chalkFactory = (options) => {
  const chalk2 = (...strings) => strings.join(" ");
  applyOptions(chalk2, options);
  Object.setPrototypeOf(chalk2, createChalk.prototype);
  return chalk2;
};
function createChalk(options) {
  return chalkFactory(options);
}
Object.setPrototypeOf(createChalk.prototype, Function.prototype);
for (const [styleName, style] of Object.entries(ansi_styles_default)) {
  styles2[styleName] = {
    get() {
      const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
      Object.defineProperty(this, styleName, { value: builder });
      return builder;
    }
  };
}
styles2.visible = {
  get() {
    const builder = createBuilder(this, this[STYLER], true);
    Object.defineProperty(this, "visible", { value: builder });
    return builder;
  }
};
var getModelAnsi = (model, level2, type, ...arguments_) => {
  if (model === "rgb") {
    if (level2 === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level2 === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model === "hex") {
    return getModelAnsi("rgb", level2, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model](...arguments_);
};
var usedModels = ["rgb", "hex", "ansi256"];
for (const model of usedModels) {
  styles2[model] = {
    get() {
      const { level: level2 } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level2], "color", ...arguments_), ansi_styles_default.color.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
  const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
  styles2[bgModel] = {
    get() {
      const { level: level2 } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level2], "bgColor", ...arguments_), ansi_styles_default.bgColor.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
}
var proto = Object.defineProperties(() => {
}, {
  ...styles2,
  level: {
    enumerable: true,
    get() {
      return this[GENERATOR].level;
    },
    set(level2) {
      this[GENERATOR].level = level2;
    }
  }
});
var createStyler = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === void 0) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent
  };
};
var createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) => applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
};
var applyStyle = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }
  let styler = self[STYLER];
  if (styler === void 0) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== void 0) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf("\n");
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
};
Object.defineProperties(createChalk.prototype, styles2);
var chalk = createChalk();
var chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
var source_default = chalk;

// node_modules/@randajan/simple-lib/dist/chunk-KF2SC7L5.js
var chalkProps = Object.getOwnPropertyNames(Object.getPrototypeOf(source_default)).filter((v) => v !== "constructor");
var Logger = class _Logger extends Function {
  constructor(formater, chalkInit) {
    super();
    const chalk2 = chalkInit || source_default;
    const log2 = (...msgs) => {
      console.log(chalk2(formater(msgs)));
    };
    const self = Object.setPrototypeOf(log2.bind(), new.target.prototype);
    for (const prop of chalkProps) {
      Object.defineProperty(self, prop, { get: (_) => new _Logger(formater, chalk2[prop]), enumerable: false });
    }
    return self;
  }
};
var logger = (...prefixes) => {
  const now = (_) => (/* @__PURE__ */ new Date()).toLocaleTimeString("cs-CZ");
  prefixes = prefixes.filter((v) => !!v).join(" ");
  return new Logger((msgs) => `${prefixes} | ${now()} | ${msgs.join(" ")}`);
};

// node_modules/@randajan/simple-lib/dist/chunk-XM4YD4K6.js
var enumerable = true;
var lockObject = (o) => {
  if (typeof o !== "object") {
    return o;
  }
  const r = {};
  for (const i in o) {
    const descriptor = { enumerable };
    let val = o[i];
    if (val instanceof Array) {
      descriptor.get = (_) => [...val];
    } else {
      descriptor.value = lockObject(val);
    }
    Object.defineProperty(r, i, descriptor);
  }
  return r;
};
var info = lockObject(define_slib_info_default);

// node_modules/@randajan/simple-lib/dist/node/index.js
import { parentPort } from "worker_threads";
var log = logger(info.name, info.version, info.env);
parentPort.on("message", (msg) => {
  if (msg === "shutdown") {
    process.exit(0);
  }
});
process.on("uncaughtException", (e) => {
  console.log(e.stack);
});

// demo/src/index.js
import assert from "assert/strict";

// dist/esm/chunk-27B7V7QV.mjs
var TIMEOUT_MESSAGES = {
  total: "Transaction exceeded totalMs",
  op: "Operation exceeded opMs",
  idle: "Transaction exceeded idleMs"
};
var CharonError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
};
var TxError = class extends CharonError {
  constructor(code, message, log2 = []) {
    super(code, message);
    this.log = Object.freeze([...log2]);
  }
};
var TxTimeoutError = class extends TxError {
  constructor(limit, ms, log2) {
    const message = TIMEOUT_MESSAGES[limit] ?? `Transaction exceeded '${limit}' time limit`;
    super(limit, `${message} (${ms} ms)`, log2);
    this.ms = ms;
  }
};
var TxAbortError = class extends TxError {
  constructor(log2) {
    super("manual", "Transaction was interrupted", log2);
  }
};
var PendingAbortError = class extends CharonError {
  constructor(code) {
    super(code, `Pending ${code} were aborted`);
  }
};
var Observer = class {
  #opt;
  constructor(opt = {}) {
    this.#opt = Object.freeze({ ...opt });
  }
  get opt() {
    return this.#opt;
  }
  createTxCtx(tx, opt) {
    return opt;
  }
  createOpCtx(tx, ctx, opt) {
    return { ctx, opt };
  }
  onCreate(tx, ctx) {
  }
  onOpen(tx, ctx) {
  }
  onTouch(tx, ctx, opt) {
  }
  onAddOp(tx, opCtx) {
  }
  onStartOp(tx, opCtx) {
  }
  onEndOp(tx, opCtx) {
  }
  onAbort(tx, ctx, opt) {
  }
  onClosing(tx, ctx, opt) {
  }
  onDestroy(tx, ctx) {
  }
};

// dist/esm/index.mjs
import { setTimeoutUnref, validateTimeout } from "@randajan/bounce";
var PromiseQueue = class {
  #queue = [];
  #running = false;
  #drain = [];
  get size() {
    return this.#queue.length + (this.#running ? 1 : 0);
  }
  get state() {
    return this.#running ? "busy" : "idle";
  }
  isState(state) {
    return this.state === state;
  }
  run(callback) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ callback, resolve, reject });
      this.#next();
    });
  }
  abort(reason) {
    reason ??= new PendingAbortError("operations");
    const queue = this.#queue.splice(0);
    for (const { reject } of queue) {
      reject(reason);
    }
    this.#resolveDrain();
    return queue.length;
  }
  drain() {
    if (!this.size) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.#drain.push(resolve));
  }
  #next() {
    if (this.#running) {
      return;
    }
    const task = this.#queue.shift();
    if (!task) {
      return this.#resolveDrain();
    }
    this.#running = true;
    Promise.resolve().then(task.callback).then(task.resolve, task.reject).finally(() => {
      this.#running = false;
      this.#next();
    });
  }
  #resolveDrain() {
    if (this.size) {
      return;
    }
    for (const resolve of this.#drain.splice(0)) {
      resolve();
    }
  }
};
var TxPublic = class {
  #tx;
  constructor(txContext) {
    this.#tx = txContext;
  }
  get state() {
    return this.#tx.state;
  }
  isState(state) {
    return this.#tx.isState(state);
  }
  get lock() {
    return this.#tx.lock;
  }
  get key() {
    return this.#tx.key;
  }
  get size() {
    return this.#tx.size;
  }
  get signal() {
    return this.#tx.signal;
  }
  run(op, opt) {
    return this.#tx.run(op, opt);
  }
  touch(opt) {
    return this.#tx.touch(opt);
  }
  abort(reason, opt) {
    return this.#tx.abort(reason, opt);
  }
  close(opt) {
    return this.#tx.close(opt);
  }
  kill(opt) {
    return this.#tx.kill(opt);
  }
};
var TxPrivate = class extends PromiseQueue {
  #cfg;
  #ac = new AbortController();
  #state = "pending";
  constructor(lock, key, observer, opt, onDestroy = (() => {
  })) {
    super();
    opt ??= {};
    const throwError = opt.throwError;
    const txPublic = new TxPublic(this);
    this.#cfg = { lock, key, throwError, public: txPublic, observer, onDestroy };
    const ctx = this.#cfg.ctx = observer?.createTxCtx(txPublic, opt);
    try {
      observer?.onCreate(txPublic, ctx);
    } catch {
    }
  }
  get public() {
    return this.#cfg.public;
  }
  get lock() {
    return this.#cfg.lock;
  }
  get key() {
    return this.#cfg.key;
  }
  get signal() {
    return this.#ac.signal;
  }
  get state() {
    return this.#state ?? super.state;
  }
  isState(state) {
    return this.state === state;
  }
  formatThrowError(opt) {
    return this.lock.formatThrowError(opt?.throwError ?? this.#cfg.throwError);
  }
  check(condition, message, opt) {
    if (condition) {
      return true;
    }
    if (!this.formatThrowError(opt)) {
      return false;
    }
    throw new Error(`Transaction '${this.key}' ${message}`);
  }
  mustIdle(opt) {
    return this.check(this.isState("idle"), "is not idling", opt);
  }
  mustAborted(opt) {
    return this.check(this.signal.aborted, "was not aborted", opt);
  }
  mustClosing(opt) {
    return this.check(this.isState("closing"), "is not closing", opt);
  }
  notAborted(opt) {
    return this.check(!this.isState("aborted"), "was aborted", opt);
  }
  notClosing(opt) {
    return this.check(!this.isState("closing"), "is closing", opt);
  }
  notDestroyed(opt) {
    return this.check(!this.isState("destroyed"), "was destroyed", opt);
  }
  open() {
    if (this.#state !== "pending") {
      return this.public;
    }
    const { observer, public: txPublic, ctx } = this.#cfg;
    this.#state = null;
    try {
      observer?.onOpen(txPublic, ctx);
    } catch {
    }
    return txPublic;
  }
  touch(opt) {
    if (!this.mustIdle(opt)) {
      return false;
    }
    const { observer, public: txPublic, ctx } = this.#cfg;
    try {
      observer?.onTouch(txPublic, ctx, opt);
    } catch {
    }
    return true;
  }
  async run(op, opt) {
    const { observer, public: txPublic, ctx } = this.#cfg;
    if (!this.notDestroyed(opt) || !this.notClosing(opt) || !this.notAborted(opt)) {
      return false;
    }
    const opCtx = observer?.createOpCtx(txPublic, ctx, opt);
    try {
      observer?.onAddOp(txPublic, opCtx);
    } catch {
    }
    try {
      return await super.run((_) => {
        try {
          observer?.onStartOp(txPublic, opCtx);
        } catch {
        }
        return op(txPublic);
      });
    } finally {
      try {
        observer?.onEndOp(txPublic, opCtx);
      } catch {
      }
    }
  }
  abort(reason, opt) {
    if (!this.notDestroyed(opt) || !this.notAborted(opt)) {
      return false;
    }
    const { observer, public: txPublic, ctx } = this.#cfg;
    reason = reason ?? new TxAbortError();
    this.#ac.abort(reason);
    super.abort(reason);
    this.#state = "aborted";
    try {
      observer?.onAbort(txPublic, ctx, opt);
    } catch {
    }
    return true;
  }
  async close(opt) {
    if (!this.notDestroyed(opt) || !this.notClosing(opt)) {
      return false;
    }
    const { observer, public: txPublic, ctx } = this.#cfg;
    try {
      observer?.onClosing(txPublic, ctx, opt);
    } catch {
    }
    this.#state = "closing";
    await super.drain();
    this.destroy();
    return true;
  }
  destroy() {
    if (this.#state === "destroyed") {
      return false;
    }
    const { observer, public: txPublic, ctx, onDestroy } = this.#cfg;
    this.#state = "destroyed";
    try {
      onDestroy(this);
    } catch {
    }
    try {
      observer?.onDestroy(txPublic, ctx);
    } catch {
    }
    return true;
  }
  kill(opt) {
    if (!this.mustAborted(opt) || !this.mustClosing(opt)) {
      return false;
    }
    return this.destroy();
  }
};
var validObj = (obj, require2 = false, label = "") => {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj;
  }
  if (obj == null && !require2) {
    return;
  }
  throw TypeError(`${label} must be type of object`);
};
var validFn = (fn, require2 = false, label = "") => {
  if (typeof fn === "function") {
    return fn;
  }
  if (fn == null && !require2) {
    return;
  }
  throw TypeError(`${label} must be type of function`);
};
var Lock = class {
  #cfg;
  #queue = [];
  #tx;
  constructor(cfg = {}) {
    cfg = validObj(cfg, true, "Lock cfg");
    const { generateKey, onOpen, onClose, observer, throwError } = cfg;
    this.#cfg = {
      throwError: !!throwError,
      observer,
      generateKey: validFn(generateKey, true, "Lock cfg.generateKey"),
      onOpen: validFn(onOpen, false, "Lock cfg.onOpen") ?? (() => {
      }),
      onClose: validFn(onClose, false, "Lock cfg.onClose") ?? (() => {
      }),
      onDestroyTx: this.#detachTx.bind(this)
    };
  }
  get size() {
    return this.#queue.length;
  }
  get state() {
    return !this.#tx ? "ready" : this.#tx.state;
  }
  isState(state) {
    return this.state === state;
  }
  formatThrowError(throwError = void 0) {
    return throwError != null ? !!throwError : this.#cfg.throwError;
  }
  #createTx(opt) {
    const { generateKey, onDestroyTx, observer } = this.#cfg;
    const key = generateKey();
    if (key == null) {
      throw new TypeError(`Lock cfg.generateKey returned null or undefined`);
    }
    return new TxPrivate(this, key, observer, opt, onDestroyTx);
  }
  #attachTx(tx) {
    return (this.#tx = tx).open();
  }
  #detachTx(tx, opt) {
    if (this.#tx !== tx) {
      return;
    }
    this.#tx = void 0;
    const next = this.#queue.shift();
    const hasNext = !!next;
    if (hasNext) {
      next.resolve(this.#attachTx(next.tx));
    }
    try {
      this.#cfg.onClose(this, hasNext);
    } catch {
    }
  }
  getTx(key, throwError = void 0) {
    if (key === this.#tx?.key) {
      return this.#tx.public;
    }
    if (!this.formatThrowError(throwError)) {
      return;
    }
    throw new Error(`Transaction '${key}' not found`);
  }
  async openTx(opt) {
    try {
      this.#cfg.onOpen(this);
    } catch {
    }
    const tx = this.#createTx(opt);
    if (!this.#tx) {
      return this.#attachTx(tx);
    }
    return new Promise((resolve, reject) => this.#queue.push({ resolve, reject, tx }));
  }
  abortAll(reason, opt) {
    reason ??= new PendingAbortError("transactions");
    this.#tx?.abort(reason, opt);
    const queue = this.#queue.splice(0);
    for (const { reject, tx } of queue) {
      tx.destroy();
      reject(reason);
    }
    return queue.length;
  }
  async run(op, opt) {
    const txPublic = await this.openTx({ ...opt || {}, singleOp: true });
    try {
      return await txPublic.run(op, opt);
    } finally {
      await txPublic.close(opt);
    }
  }
  async runTx(tx, opt) {
    const txPublic = await this.openTx(opt);
    try {
      return await tx(txPublic);
    } finally {
      await txPublic.close(opt);
    }
  }
};
var Charon = class {
  #locks = /* @__PURE__ */ new Map();
  #cfg = {};
  constructor(cfg = {}) {
    const cfgAll = validObj(cfg, false, "Charon cfg");
    const { onOpen, onClose, retainMs, ...lockCfg } = cfgAll;
    this.#cfg.lockCfg = lockCfg;
    this.#cfg.retainMs = validateTimeout(retainMs, "Charon cfg.retainMs") ?? 6e4;
    this.#cfg.onOpen = validFn(onOpen, false, "Charon cfg.onOpen") ?? (() => {
    });
    this.#cfg.onClose = validFn(onClose, false, "Charon cfg.onClose") ?? (() => {
    });
  }
  get size() {
    return this.#locks.size;
  }
  keys() {
    return this.#locks.keys();
  }
  values() {
    return this.#locks.values();
  }
  entries() {
    return this.#locks.entries();
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  #create(id) {
    const { lockCfg, retainMs, onOpen, onClose } = this.#cfg;
    let lock, ctid;
    const cleanUp = () => {
      if (lock?.state !== "ready") {
        return;
      }
      if (lock !== this.#locks.get(id)) {
        return;
      }
      this.#locks.delete(id);
    };
    const cfg = { ...lockCfg };
    cfg.onOpen = (lock2) => {
      clearTimeout(ctid);
      onOpen(this, { lock: lock2, id });
    };
    cfg.onClose = (lock2, hasNext) => {
      if (!hasNext) {
        ctid = setTimeoutUnref(cleanUp, retainMs, cfg.unref);
      }
      onClose(this, { lock: lock2, id, hasNext });
    };
    this.#locks.set(id, lock = new Lock(cfg));
    return lock;
  }
  get(id, throwError = false) {
    const lock = this.#locks.get(id);
    if (lock) {
      return lock;
    }
    if (!throwError) {
      return;
    }
    throw new Error(`Lock '${id}' does not exist`);
  }
  has(id, throwError = false) {
    return !!this.get(id, throwError);
  }
  ensure(id) {
    return this.#locks.get(id) ?? this.#create(id);
  }
};
var index_default = Charon;

// dist/esm/obs/timed/index.mjs
import { Bounce, validateTimeout as validateTimeout2 } from "@randajan/bounce";
import { setTimeoutUnref as setTimeoutUnref2, validateTimeout as validateTimeout3 } from "@randajan/bounce";
import { setTimeoutUnref as setTimeoutUnref22 } from "@randajan/bounce";
var formatTimeoutConfig = (opt = {}, fallback = {}, label = "Transaction opt") => {
  opt ??= {};
  return Object.freeze({
    singleOp: opt.singleOp != null ? !!opt.singleOp : !!fallback.singleOp,
    totalMs: validateTimeout3(opt.totalMs, `${label}.totalMs`) ?? fallback.totalMs,
    opMs: validateTimeout3(opt.opMs, `${label}.opMs`) ?? fallback.opMs,
    idleMs: validateTimeout3(opt.idleMs, `${label}.idleMs`) ?? fallback.idleMs,
    forceCloseMs: validateTimeout3(opt.forceCloseMs, `${label}.forceCloseMs`) ?? fallback.forceCloseMs,
    forceKillMs: validateTimeout3(opt.forceKillMs, `${label}.forceKillMs`) ?? fallback.forceKillMs,
    unref: opt.unref != null ? !!opt.unref : !!fallback.unref
  });
};
var TimeoutContext = class {
  #cfg;
  #log = [];
  #forceCloseId;
  #killId;
  constructor(cfg) {
    this.#cfg = cfg;
  }
  get cfg() {
    return this.#cfg;
  }
  get log() {
    return this.#log;
  }
  createOpCtx(opt = {}) {
    opt ??= {};
    return Object.freeze({
      txCtx: this,
      opMs: validateTimeout3(opt.opMs, "Operation opt.opMs") ?? this.cfg.opMs,
      idleMs: validateTimeout3(opt.idleMs, "Operation opt.idleMs") ?? this.cfg.idleMs
    });
  }
  addLog(status, ms) {
    const record = Object.freeze({ status, ms, ts: Date.now() });
    this.#log.push(record);
    return record;
  }
  replaceLog(log2) {
    this.#log = log2;
  }
  timeout(tx, limit, ms, log2 = this.log) {
    tx.abort(new TxTimeoutError(limit, ms, log2), { throwError: false });
  }
  stop() {
  }
  onCreate(tx) {
  }
  onOpen(tx) {
  }
  onTouch(tx, opt) {
  }
  onAddOp(tx, opCtx) {
  }
  onStartOp(tx, opCtx) {
  }
  onEndOp(tx, opCtx) {
  }
  onClosing(tx) {
    const { forceKillMs, unref } = this.cfg;
    if (!(forceKillMs > 0) || this.#killId != null) {
      return;
    }
    this.#killId = setTimeoutUnref2(
      () => tx.kill({ throwError: false }),
      forceKillMs,
      unref
    );
  }
  onAbort(tx) {
    this.stop();
    if (tx.signal.reason instanceof TxAbortError) {
      tx.signal.reason.log = Object.freeze([...this.log]);
    }
    const { forceCloseMs, unref } = this.cfg;
    if (!(forceCloseMs > 0) || this.#forceCloseId != null) {
      return;
    }
    this.#forceCloseId = setTimeoutUnref2(() => {
      Promise.resolve(tx.close({ throwError: false })).catch(() => {
      });
    }, forceCloseMs, unref);
  }
  onDestroy() {
    this.stop();
    clearTimeout(this.#forceCloseId);
    clearTimeout(this.#killId);
    this.#forceCloseId = void 0;
    this.#killId = void 0;
  }
};
var MultiTimeoutContext = class extends TimeoutContext {
  #bounce;
  #getBounce(tx) {
    if (this.#bounce) {
      return this.#bounce;
    }
    const { totalMs, unref } = this.cfg;
    const onBounce = (log2, trigger) => {
      this.replaceLog(log2);
      const last = log2.at(-1);
      const limit = trigger === "hard" ? "total" : last?.status === "op" ? "op" : "idle";
      const ms = trigger === "hard" ? totalMs : last?.ms;
      this.timeout(tx, limit, ms, log2);
    };
    return this.#bounce = new Bounce(onBounce, { hardMs: totalMs, unref });
  }
  #touch(tx, status, ms) {
    const record = this.addLog(status, ms);
    this.#getBounce(tx).attach(record, ms);
  }
  onOpen(tx) {
    this.#touch(tx, "idle", this.cfg.idleMs);
  }
  onTouch(tx, opt) {
    const idleMs = validateTimeout2(opt?.idleMs, "Transaction opt.idleMs") ?? this.cfg.idleMs;
    this.#touch(tx, "touch", idleMs);
  }
  onStartOp(tx, opCtx) {
    this.#touch(tx, "op", opCtx.opMs);
  }
  onEndOp(tx, opCtx) {
    if (!tx.signal.aborted) {
      this.#touch(tx, "idle", opCtx.idleMs);
    }
  }
  stop() {
    if (this.#bounce?.state) {
      this.#bounce.flush();
    }
  }
};
var SingleTimeoutContext = class extends TimeoutContext {
  #timeoutId;
  onStartOp(tx, opCtx) {
    const { totalMs, unref } = this.cfg;
    const { opMs } = opCtx;
    const totalWins = totalMs > 0 && (!(opMs > 0) || totalMs <= opMs);
    const limit = totalWins ? "total" : "op";
    const ms = totalWins ? totalMs : opMs;
    this.addLog("op", ms);
    clearTimeout(this.#timeoutId);
    if (ms > 0) {
      this.#timeoutId = setTimeoutUnref22(
        () => this.timeout(tx, limit, ms),
        ms,
        unref
      );
    }
  }
  onEndOp(tx) {
    if (tx.signal.aborted) {
      return;
    }
    this.stop();
    this.addLog("idle", 0);
  }
  stop() {
    clearTimeout(this.#timeoutId);
    this.#timeoutId = void 0;
  }
};
var TimeoutObserver = class extends Observer {
  #cfg;
  constructor(opt = {}) {
    super(opt);
    this.#cfg = formatTimeoutConfig(opt, {}, "TimeoutObserver opt");
  }
  createTxCtx(tx, opt) {
    const cfg = formatTimeoutConfig(opt, this.#cfg);
    return cfg.singleOp ? new SingleTimeoutContext(cfg) : new MultiTimeoutContext(cfg);
  }
  createOpCtx(tx, ctx, opt) {
    return ctx.createOpCtx(opt);
  }
  onCreate(tx, ctx) {
    return ctx.onCreate(tx);
  }
  onOpen(tx, ctx) {
    return ctx.onOpen(tx);
  }
  onTouch(tx, ctx, opt) {
    return ctx.onTouch(tx, opt);
  }
  onAddOp(tx, opCtx) {
    return opCtx.txCtx.onAddOp(tx, opCtx);
  }
  onStartOp(tx, opCtx) {
    return opCtx.txCtx.onStartOp(tx, opCtx);
  }
  onEndOp(tx, opCtx) {
    return opCtx.txCtx.onEndOp(tx, opCtx);
  }
  onAbort(tx, ctx, opt) {
    return ctx.onAbort(tx, opt);
  }
  onClosing(tx, ctx, opt) {
    return ctx.onClosing(tx, opt);
  }
  onDestroy(tx, ctx) {
    return ctx.onDestroy(tx);
  }
};
var timed_default = TimeoutObserver;

// demo/src/index.js
var wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var waitForAbort = (signal, timeoutMs = 200) => new Promise((resolve, reject) => {
  if (signal.aborted) {
    return resolve(signal.reason);
  }
  const timeout = setTimeout(() => {
    reject(new Error("Transaction did not abort in time"));
  }, timeoutMs);
  signal.addEventListener("abort", () => {
    clearTimeout(timeout);
    resolve(signal.reason);
  }, { once: true });
});
var waitUntil = async (predicate, timeoutMs = 200) => {
  const expiresAt = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= expiresAt) {
      throw new Error("Condition was not met in time");
    }
    await wait(5);
  }
};
var createKeyGenerator = (prefix = "tx") => {
  let id = 0;
  return () => `${prefix}-${++id}`;
};
var runDemo = async (label, callback) => {
  process.stdout.write(`
${label}
`);
  await callback();
  console.log("  \u2713 all checks passed");
};
var assertLog = (log2, expected) => {
  assert.deepEqual(
    log2.map(({ status, ms }) => ({ status, ms })),
    expected
  );
  assert.ok(log2.every(({ ts }) => Number.isFinite(ts)));
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
    observer: new timed_default({ opMs: 20, unref: false })
  });
  const reason = await lock.run((tx) => waitForAbort(tx.signal));
  assert.equal(reason.code, "op");
  assert.equal(reason.ms, 20);
  assertLog(reason.log, [{ status: "op", ms: 20 }]);
  assert.equal(lock.state, "ready");
});
await runDemo("4. MultiTimeoutContext serializes transaction operations", async () => {
  const lock = new Lock({
    generateKey: createKeyGenerator("multi"),
    observer: new timed_default()
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
    observer: new timed_default({ idleMs: 20, unref: false })
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
    observer: new timed_default({
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
    observer: new timed_default({
      idleMs: 15,
      forceCloseMs: 15,
      unref: false
    }),
    onClose: (_lock, hasNext) => closed.push(hasNext)
  });
  const tx = await lock.openTx();
  await waitForAbort(tx.signal);
  await waitUntil(() => lock.state === "ready");
  assert.equal(lock.getTx(tx.key), void 0);
  assert.deepEqual(closed, [false]);
});
await runDemo("8. Manual abort preserves its activity log", async () => {
  const lock = new Lock({
    generateKey: createKeyGenerator("manual"),
    observer: new timed_default()
  });
  const tx = await lock.openTx();
  assert.equal(tx.abort(), true);
  assert.equal(tx.signal.reason.code, "manual");
  assertLog(tx.signal.reason.log, [{ status: "idle", ms: void 0 }]);
  assert.equal(await tx.run(async () => "must not run"), false);
  assert.equal(tx.touch(), false);
  assert.equal(tx.abort(), false);
  assert.equal(await tx.close(), true);
  assert.equal(lock.state, "ready");
});
await runDemo("9. Operation options override observer defaults", async () => {
  const lock = new Lock({
    generateKey: createKeyGenerator("override"),
    observer: new timed_default({ opMs: 100, unref: false })
  });
  const tx = await lock.openTx();
  const reason = await tx.run(
    (currentTx) => waitForAbort(currentTx.signal),
    { opMs: 20 }
  );
  assert.equal(reason.code, "op");
  assert.equal(reason.ms, 20);
  assertLog(reason.log, [
    { status: "idle", ms: void 0 },
    { status: "op", ms: 20 }
  ]);
  assert.equal(await tx.close(), true);
});
await runDemo("10. Manual abort preserves a custom Error", async () => {
  const lock = new Lock({
    generateKey: createKeyGenerator("custom-abort"),
    observer: new timed_default()
  });
  const tx = await lock.openTx();
  const reason = new Error("cancelled by owner");
  let releaseOperation;
  let markOperationStarted;
  const operationBlocker = new Promise((resolve) => {
    releaseOperation = resolve;
  });
  const operationStarted = new Promise((resolve) => {
    markOperationStarted = resolve;
  });
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
    observer: new timed_default()
  });
  const active = await lock.openTx();
  const pendingA = lock.openTx().then(
    () => void 0,
    (reason2) => reason2
  );
  const pendingB = lock.openTx().then(
    () => void 0,
    (reason2) => reason2
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
    observer: new timed_default()
  });
  const stuckTx = await lock.openTx();
  let markOperationStarted;
  const operationStarted = new Promise((resolve) => {
    markOperationStarted = resolve;
  });
  stuckTx.run(async () => {
    markOperationStarted();
    await new Promise(() => {
    });
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
    observer: new timed_default({
      opMs: 15,
      forceCloseMs: 15,
      forceKillMs: 15,
      unref: false
    })
  });
  const stuckTx = await lock.openTx();
  let markOperationStarted;
  const operationStarted = new Promise((resolve) => {
    markOperationStarted = resolve;
  });
  stuckTx.run(async () => {
    markOperationStarted();
    await new Promise(() => {
    });
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
  assert.equal(index_default, Charon);
  const locks = new index_default({
    generateKey: createKeyGenerator("charon"),
    observer: new timed_default(),
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
//# sourceMappingURL=index.js.map
