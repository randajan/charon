import slib, { argv } from "@randajan/simple-lib";


slib(argv.isBuild, {
    mode:"node",
    external:["chalk"],
    lib:{
        entries:["index.js", "obs/timed/index.js"],
        statics:["types"]
    },
    demo:{
        
    }
})