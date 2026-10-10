

export const validObj = (obj, require=false, label="")=>{
    if (obj && typeof obj === "object" && !Array.isArray(obj)) { return obj; }
    if (obj == null && !require) { return; }
    throw TypeError(`${label} must be type of object`);
}

export const validFn = (fn, require=false, label="")=>{
    if (typeof fn === "function") { return fn; }
    if (fn == null && !require) { return; }
    throw TypeError(`${label} must be type of function`);
}