import {dispatch} from './engine.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;
try{const {action,args}=JSON.parse(input);console.log(JSON.stringify({data:await dispatch(action,args)}));}catch(e){console.log(JSON.stringify({error:e.message}));}
