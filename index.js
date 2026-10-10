import slib, { argv } from "@randajan/simple-lib";


slib(argv.isBuild, {
    mode:"node",
    external:["chalk"],
    lib:{
        statics:["types"]
    },
    demo:{
        
    }
})