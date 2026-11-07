const $=s=>document.querySelector(s);let token=localStorage.getItem("bw_token")||"",me=null,selectedTable=null,authMode="login",authBusy=false;
async function api(path,opts={}){const res=await fetch("/api/"+path,{...opts,headers:{"content-type":"application/json",...(token?{authorization:"Bearer "+token}:{}),...(opts.headers||{})},cache:"no-store"});const type=res.headers.get("content-type")||"type inconnu";let data;try{if(!type.toLowerCase().includes("application/json"))throw Error("non-json");data=await res.json()}catch{throw Error("Réponse API non JSON (HTTP "+res.status+", "+type+"). Les Pages Functions ne répondent probablement pas sur /api/"+path+". Testez /api/health et redéployez via Git ou Wrangler.")}if(!res.ok)throw Error(data.error||"Erreur HTTP "+res.status);return data}
function notice(s){$("#notice").textContent=s||""}
function renderProfileAvatar(url,username=me?.username||"?"){
 const img=$("#profileAvatarImage"),fallback=$("#profileAvatarFallback");
 if(!img||!fallback)return;
 fallback.textContent=String(username||"?").trim().slice(0,1).toUpperCase()||"?";
 img.onerror=()=>{img.hidden=true;fallback.hidden=false};
 if(url){img.src=url;img.hidden=false;fallback.hidden=true}else{img.removeAttribute("src");img.hidden=true;fallback.hidden=false}
}
const avatarInput=$("#profileForm [name=avatar]");
if(avatarInput)avatarInput.addEventListener("input",()=>renderProfileAvatar(avatarInput.value,$("#profileForm [name=username]").value));
const profileUsernameInput=$("#profileForm [name=username]");
if(profileUsernameInput)profileUsernameInput.addEventListener("input",()=>renderProfileAvatar(avatarInput?.value,profileUsernameInput.value));
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function authMessage(message){const error=$("#authError");error.textContent=message||"";error.hidden=!message;}
function setAuthBusy(busy){
 authBusy=busy;$("#authForm").setAttribute("aria-busy",String(busy));
 $("#authForm").querySelectorAll("input,button").forEach(control=>{control.disabled=busy;});
 $("#authSubmit").textContent=busy?(authMode==="register"?"Création en cours…":"Connexion en cours…"):(authMode==="register"?"Créer mon compte":"Connexion");
}
function openAuth(mode){
 if(authBusy)return;authMode=mode;authMessage("");
 $("#authTitle").textContent=mode==="login"?"Connexion":"Ouvrir un compte";
 $("#authEyebrow").textContent=mode==="login"?"BON RETOUR AU CLUB":"VOTRE PLACE VOUS ATTEND";
 $("#authSwitch").textContent=mode==="login"?"Pas encore de compte ? Cliquez ici pour vous inscrire.":"Déjà inscrit ? Cliquez ici pour vous connecter.";
 const password=$("#authForm [name=password]");password.minLength=mode==="register"?6:1;password.autocomplete=mode==="register"?"new-password":"current-password";
 setAuthBusy(false);$("#authDialog").showModal();
}
$("#authDialog").addEventListener("cancel",event=>{if(authBusy)event.preventDefault();});
$("#authForm").addEventListener("input",()=>authMessage(""));
$("#authForm").addEventListener("invalid",event=>{if(!authBusy&&$("#authError").hidden)authMessage(event.target.validationMessage||"Vérifiez les champs avant de valider.");},true);
document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openAuth(b.dataset.open));
const menuToggle=$("#menuToggle"),siteMenu=$("#siteMenu");if(menuToggle)menuToggle.onclick=()=>{const open=siteMenu.classList.toggle("hidden")===false;menuToggle.setAttribute("aria-expanded",String(open))};document.addEventListener("click",e=>{if(siteMenu&&!e.target.closest(".nav-menu-wrap")){siteMenu.classList.add("hidden");menuToggle?.setAttribute("aria-expanded","false")}});siteMenu.addEventListener("click",e=>{const item=e.target.closest("[data-menu-action]");if(!item)return;const action=item.dataset.menuAction;siteMenu.classList.add("hidden");menuToggle?.setAttribute("aria-expanded","false");if(action==="login")openAuth("login");else if(action==="register")openAuth("register");else if(action==="profile"){if(me)$("#profileDialog").showModal();else openAuth("login")}else if(action==="logout")$("#logoutBtn").click()});$("#authSwitch").onclick=()=>openAuth(authMode==="login"?"register":"login");$("#authDialog .close").onclick=()=>$("#authDialog").close();$("#closeProfile").onclick=()=>$("#profileDialog").close();
$("#authForm").onsubmit=async event=>{
 event.preventDefault();if(authBusy)return;const form=event.currentTarget;if(!form.reportValidity())return;
 const values=new FormData(form),mode=authMode,controller=new AbortController();let accepted=false;
 authMessage("");setAuthBusy(true);const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const data=await api(mode,{method:"POST",body:JSON.stringify({username:values.get("username"),password:values.get("password")}),signal:controller.signal});
  if(!data||typeof data.token!=="string"||!data.token||!data.user||typeof data.user.username!=="string")throw Error("Le service de connexion a renvoyé une réponse incomplète. Réessayez.");
  accepted=true;token=data.token;localStorage.setItem("bw_token",token);
  await init({propagateError:true,signal:controller.signal});
  $("#authDialog").close();form.reset();notice(mode==="register"?"Compte créé avec 0 jeton. Contactez un responsable du club pour demander des jetons.":"Connexion réussie.");
 }catch(error){
  let message=error?.message||"La connexion n’a pas pu aboutir. Réessayez.";
  if(error?.name==="AbortError")message="La demande a pris trop de temps. Vérifiez votre connexion puis réessayez.";
  else if(error instanceof TypeError)message="Connexion impossible. Vérifiez votre connexion internet puis réessayez.";
  else if(message.startsWith("Réponse API non JSON"))message="Le service de connexion est indisponible. Réessayez ou contactez un responsable du club.";
  else if(error?.name==="SecurityError")message="Le navigateur ne permet pas d’enregistrer la session. Vérifiez ses réglages de confidentialité.";
  if(mode==="register"&&message==="Ce nom est réservé.")message+=" Utilisez Connexion pour accéder au compte administrateur.";
  if(accepted&&mode==="register")message="Le compte a été créé, mais la connexion n’a pas pu être finalisée. Passez en mode Connexion pour réessayer. "+message;
  authMessage(message);
 }finally{clearTimeout(timer);setAuthBusy(false);}
};
$("#logoutBtn").onclick=()=>{token="";me=null;localStorage.removeItem("bw_token");$("#profileDialog").close();$("#tablePanel").classList.add("hidden");renderAccount();notice("Vous êtes déconnecté.")};
$("#profileForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api("profile",{method:"POST",body:JSON.stringify({username:f.get("username"),avatar:f.get("avatar")})});notice("Profil mis à jour.");await init()}catch(err){notice(err.message)}};$("#passwordForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);if(f.get("newPassword")!==f.get("confirmPassword")){notice("Les deux nouveaux mots de passe ne correspondent pas.");return}try{await api("profile",{method:"POST",body:JSON.stringify({username:me.username,avatar:me.avatar||"",currentPassword:f.get("currentPassword"),newPassword:f.get("newPassword")})});e.target.reset();notice("Mot de passe modifié.")}catch(err){notice(err.message)}};
const refreshBtn=$("#refreshBtn");if(refreshBtn)refreshBtn.onclick=loadTables;$("#leaveBtn").onclick=async()=>{if(!selectedTable)return;try{await api("leave",{method:"POST",body:JSON.stringify({tableId:selectedTable})});selectedTable=null;$("#tablePanel").classList.add("hidden");await loadTables()}catch(e){notice(e.message)}};
async function init({propagateError=false,signal}={}){try{if(token){const d=await api("me",{signal});me=d.user;$("#profileForm [name=username]").value=me.username;$("#profileForm [name=avatar]").value=me.avatar||"";renderProfileAvatar(me.avatar||"",me.username);$("#balanceText").textContent=Number(me.chips)===1?"1 jeton":Number(me.chips).toLocaleString("fr-FR")+" jetons";}else{$("#profileDialog").close()}renderAccount();await loadTables({signal})}catch(e){token="";me=null;localStorage.removeItem("bw_token");renderAccount();if(!propagateError)await loadTables();notice(e.message);if(propagateError)throw e;}}
function renderAccount(){const menuItems=me?`<div class="menu-account"><strong>${esc(me.username)}</strong><small>${Number(me.chips).toLocaleString("fr-FR")} jetons</small></div><button type="button" data-menu-action="profile">Mon profil et mon solde</button><button type="button" data-menu-action="logout">Déconnexion</button>`:`<button type="button" data-menu-action="login">Connexion</button><button type="button" data-menu-action="register">Créer un compte</button>`;siteMenu.innerHTML=menuItems+`<a href="./rules.html">Règles du jeu</a><a class="quiet-admin" href="./admin.html">Administration</a>`;}
async function loadTables({signal}={}){try{const d=await api("tables",{signal});const visible=(d.tables||[]).filter(t=>!t.disabled);const myTable=visible.find(t=>t.mine)?.id;$("#tables").innerHTML=visible.length?visible.map(t=>{const elsewhere=!!myTable&&Number(myTable)!==Number(t.id);return `<article class="table-card"><div class="table-card-top"><span class="table-index">TABLE Nº ${String(t.id).padStart(2,"0")}</span><span class="table-status ${t.hand?"status-live":""}"><i></i>${t.hand?"EN JEU":"OUVERTE"}</span></div><h3>${esc(t.name)}</h3><div class="mini-table-art" aria-hidden="true"><div class="mini-table-rim"><div class="mini-table-felt"><span>♠</span><b>SONS OF REAPER</b><small>PALETO BAY POKER CLUB</small><span>♣</span></div></div><div class="mini-chip chip-one"></div><div class="mini-chip chip-two"></div></div><div class="table-card-meta"><span><strong>${t.playerCount}</strong> / ${t.maxPlayers||5}<small>JOUEURS</small></span><span class="seat-dots">${Array.from({length:Number(t.maxPlayers||5)},(_,i)=>`<i class="${i<t.playerCount?"occupied":""}"></i>`).join("")}</span></div><button class="button" data-join="${t.id}" ${!me||t.playerCount>=(t.maxPlayers||5)||elsewhere?"disabled":""}>${!me?"Connectez-vous pour jouer":elsewhere?"Quittez votre table actuelle":t.playerCount>=(t.maxPlayers||5)?"Table complète":"Prendre place"}<span aria-hidden="true"> ↗</span></button></article>`}).join(""):'<p class="muted">Aucune table ouverte pour le moment.</p>';document.querySelectorAll("[data-join]").forEach(b=>b.onclick=()=>joinTable(Number(b.dataset.join)))}catch(e){$("#tables").innerHTML='<p class="muted">Impossible de charger le lobby. '+esc(e.message)+'</p>'}}
async function joinTable(id){if(!me){openAuth("login");return}try{await api("join",{method:"POST",body:JSON.stringify({tableId:id,maxPlayers:5})});selectedTable=id;location.href="./game.html?id="+id}catch(e){notice(e.message)}}
init();
