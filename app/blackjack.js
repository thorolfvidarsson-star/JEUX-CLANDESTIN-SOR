'use strict';
(() => {
 const $=s=>document.querySelector(s), nf=new Intl.NumberFormat('fr-FR');
 const labels={blackjack:'Blackjack !',win:'Belle main, vous gagnez.',push:'Égalité, mise rendue.',lose:'Le croupier l’emporte.',bust:'Au-delà de 21.',dealer_blackjack:'Blackjack du croupier.'};
 let snapshot=null,busy=false,pending=null,identity=null;
 const token=()=>localStorage.getItem('bw_token')||'';
 const message=text=>{$('#bjMessage').textContent=text||'';};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const storageKey=()=>identity?'sor_bj_pending_'+identity:null;
 function savePending(value){pending=value;const key=storageKey();if(key){if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);}}
 async function api(path,body){
  const captured=token(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch('/api/blackjack'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',authorization:'Bearer '+captured},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:controller.signal});
   let data;try{data=await response.json();}catch{throw Error('Le service de jeu est indisponible. Actualisez dans un instant.');}
   if(token()!==captured)throw Error('Votre session a changé. Rechargez cette page.');
   if(!response.ok){const error=Error(data.error||'Demande refusée.');error.status=response.status;throw error;}return data;
  }finally{clearTimeout(timer);}
 }
 function cards(list,empty){return list?.length?list.map(c=>{if(c===null)return '<span class="bj-card bj-card-back" role="img" aria-label="Carte cachée"><span>♠</span></span>';const rank=c.slice(0,-1),suit=c.slice(-1);return `<span class="bj-card" role="img" aria-label="${esc(rank+' '+suit)}"><b>${esc(rank)}<small>${esc(suit)}</small></b><i aria-hidden="true">${esc(suit)}</i><b aria-hidden="true">${esc(rank)}<small>${esc(suit)}</small></b></span>`;}).join(''):`<span class="bj-empty">${empty}</span>`;}
 function render(){
  const d=snapshot,h=d?.hand,live=h?.status==='playing',allowed=!!d?.canPlay,locked=busy||!!pending||!allowed;
  $('#bjName').textContent=d?.user.username||'Votre compte';$('#bjBalance').textContent=d?nf.format(d.user.chips):'—';
  $('#bjDealer').innerHTML=cards(h?.dealer,'La table vous attend');$('#bjPlayer').innerHTML=cards(h?.player,'Faites votre jeu');
  $('#bjDealerTotal').textContent=h?(live?'?':h.dealerTotal):'—';$('#bjPlayerTotal').textContent=h?.playerTotal??'—';$('#bjStake').textContent=h?nf.format(h.stake)+' jetons':'—';
  $('#bjPhase').textContent=live?'Votre décision':h?'La prochaine main ?':'Prenez place';
  $('#bjResult').textContent=live?'Une carte de plus, ou rester ?':h?`${labels[h.outcome]||'Main terminée'} ${h.net>0?'+':''}${nf.format(h.net)} jetons nets.`:'Une mise. Deux cartes. Visez 21.';
  $('#bjBetForm').hidden=!!live;$('#bjActions').hidden=!live;$('#bjDeal').disabled=locked;$('#bjBet').disabled=locked;
  document.querySelectorAll('[data-bet]').forEach(b=>b.disabled=locked);
  $('#bjHit').disabled=locked;$('#bjStand').disabled=locked;$('#bjDouble').disabled=locked||!h?.canDouble||(d?.user.chips??0)<(h?.bet??0);
  $('#bjDouble').textContent=h?'Doubler · +'+nf.format(h.bet)+' jetons':'Doubler la mise';
  $('#bjRetry').hidden=!pending;$('#bjRetry').disabled=busy;$('#bjRefresh').disabled=busy;
  $('#bjLogin').hidden=!!d;$('#bjAccess').textContent=d?.user.isAdmin?'Compte administrateur : gestion du club uniquement. Connectez un compte joueur pour jouer.':d?.pokerTable?'Vous êtes à la table de poker '+d.pokerTable+'. Quittez votre siège au poker avant de jouer au blackjack.':d&&d.user.chips<10&&!live?'Contactez un responsable du club pour recevoir des jetons.':'';
  $('#bjHistory').innerHTML=d?.recent.length?d.recent.map(r=>`<li><span>${esc(labels[r.outcome]||'Main terminée')}<small>Mise totale : ${nf.format(r.stake)} jetons</small></span><strong>${r.net>0?'+':''}${nf.format(r.net)}</strong></li>`).join(''):'<li class="muted">Aucune main terminée pour le moment.</li>';
  $('.bj-controls').setAttribute('aria-busy',String(busy));
 }
 async function refresh(){
  if(busy)return;if(!token()){snapshot=null;message('Connectez-vous au lobby pour retrouver votre solde et jouer.');render();return;}
  busy=true;render();try{snapshot=await api('');identity=String(snapshot.user.id);
   if(!pending){try{const saved=JSON.parse(localStorage.getItem(storageKey())||'null');if(saved&&['start','hit','stand','double'].includes(saved.action)&&saved.body?.requestId)pending=saved;}catch{localStorage.removeItem(storageKey());}}
   message(pending?'Une demande attend une confirmation. Reprenez-la pour éviter une double mise.':snapshot.hand?.status==='playing'?'Votre main en cours est prête.':'Faites votre jeu.');
  }catch(e){if(e.status===401){snapshot=null;identity=null;}message(e.message);}finally{busy=false;render();}
 }
 async function send(action,body){
  if(busy)return;busy=true;
  try{if(!pending)savePending({action,body});render();message('Le croupier prépare votre jeu…');snapshot=await api('/'+pending.action,pending.body);savePending(null);message(snapshot.hand.status==='playing'?'À vous de jouer.':'Main terminée · le solde est à jour.');}
  catch(e){
   if(e.status){savePending(null);message(e.message);try{snapshot=await api('');}catch{}}
   else message('Confirmation interrompue. Reprenez la même demande : elle ne sera comptée qu’une fois. '+(e.name==='AbortError'?'Le réseau met trop de temps à répondre.':e.message));
  }finally{busy=false;render();}
 }
 $('#bjBetForm').addEventListener('submit',e=>{e.preventDefault();if(pending||!snapshot?.canPlay||!e.currentTarget.reportValidity())return;const bet=Number($('#bjBet').value);if(bet>snapshot.user.chips){message('Votre solde ne suffit pas pour cette mise.');return;}send('start',{bet,requestId:crypto.randomUUID()});});
 document.querySelectorAll('[data-bet]').forEach(b=>b.onclick=()=>{$('#bjBet').value=b.dataset.bet;});
 for(const [id,action] of [['#bjHit','hit'],['#bjStand','stand'],['#bjDouble','double']])$(id).onclick=()=>{if(pending||!snapshot?.hand||!snapshot.canPlay)return;send(action,{handId:snapshot.hand.id,revision:snapshot.hand.revision,requestId:crypto.randomUUID()});};
 $('#bjRetry').onclick=()=>{if(pending)send(pending.action,pending.body);};$('#bjRefresh').onclick=refresh;
 window.addEventListener('storage',e=>{if(e.key==='bw_token')location.reload();});
 render();refresh();
})();
