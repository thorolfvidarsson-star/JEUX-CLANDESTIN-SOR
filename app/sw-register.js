if("serviceWorker"in navigator&&location.protocol==="https:"){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js?v=sor-1.2.0").catch(()=>{}));}
