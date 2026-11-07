'use strict';
(()=>{
 const $=s=>document.querySelector(s),nf=new Intl.NumberFormat('fr-FR'),order=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26],white=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
 const color=n=>n===0?'green':white.includes(n)?'white':'black',colorName=c=>({white:'BLANC',black:'NOIR',green:'ZÉRO VERT'}[c]);
 const token=()=>localStorage.getItem('bw_token')||'',esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let snapshot=null,identity=null,busy=false,pending=null,chip=10,bets=new Map(),undo=[],rotation=0;
 const message=s=>$('#rlMessage').textContent=s;
 function label(b){return b.type==='number'?'Numéro '+b.value:b.type==='color'?colorName(b.value):b.type==='parity'?(b.value==='even'?'Pair':'Impair'):b.type==='half'?(b.value==='low'?'1 à 18':'19 à 36'):b.type==='dozen'?['','1re douzaine · 1–12','2e douzaine · 13–24','3e douzaine · 25–36'][b.value]:'Colonne '+b.value;}
 function key(b){return b.type+':'+b.value;}
 function betButton(type,value,text,cls='',style=''){const b={type,value};return `<button type="button" class="rl-bet ${cls}" data-bet-key="${key(b)}" data-type="${type}" data-value="${value}" ${style} aria-pressed="false" aria-label="${esc(label(b))}"><span>${text}</span><small class="rl-bet-amount" hidden></small></button>`;}
 $('#rlOutside').innerHTML=betButton('color','black','NOIR','rl-black')+betButton('color','white','BLANC','rl-white')+betButton('parity','even','PAIR')+betButton('parity','odd','IMPAIR')+betButton('half','low','1–18')+betButton('half','high','19–36');
 $('#rlNumbers').innerHTML=Array.from({length:37},(_,n)=>betButton('number',n,String(n),'rl-'+color(n)+(n===0?' rl-zero':''),n?`style="--col:${Math.ceil(n/3)+1};--row:${3-(n-1)%3}"`:'')).join('');
 $('#rlDozens').innerHTML=[1,2,3].map(n=>betButton('dozen',n,['','1–12','13–24','25–36'][n])).join('');
 $('#rlColumns').innerHTML=[1,2,3].map(n=>betButton('column',n,'COL. '+n)).join('');
 if(matchMedia('(max-width:680px)').matches)$('#rlNumbersPanel').open=false;
 const point=(a,r)=>[160+Math.sin(a*Math.PI/180)*r,160-Math.cos(a*Math.PI/180)*r];
 $('#rlWheelArt').innerHTML='<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg"><circle cx="160" cy="160" r="155" class="rl-rim"/><g id="rlDisc" class="rl-disc">'+order.map((n,i)=>{const step=360/37,a=i*step,pts=[point(a-step/2,146),point(a+step/2,146),point(a+step/2,104),point(a-step/2,104)],t=point(a,126);return `<path class="rl-pocket rl-${color(n)}" d="M${pts[0]} A146 146 0 0 1 ${pts[1]} L${pts[2]} A104 104 0 0 0 ${pts[3]} Z"/><text x="${t[0]}" y="${t[1]}" transform="rotate(${a} ${t[0]} ${t[1]})" class="rl-wheel-label rl-text-${color(n)}" text-anchor="middle" dominant-baseline="central">${n}</text>`;}).join('')+'</g><circle cx="160" cy="160" r="101" class="rl-inner-rim"/></svg>';
 function storePending(value){pending=value;if(identity){const k='sor_rl_pending_'+identity;if(value)localStorage.setItem(k,JSON.stringify(value));else localStorage.removeItem(k);}}
 async function api(path='',body){const captured=token(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{
  const r=await fetch('/api/roulette'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',authorization:'Bearer '+captured},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store'});
  let d;try{d=await r.json();}catch{throw Error('Le service de roulette est indisponible. Réessayez dans un instant.');}
  if(captured!==token())throw Error('Votre session a changé. Rechargez la page.');if(!r.ok){const e=Error(d.error||'Mise refusée.');e.status=r.status;throw e;}return d;
 }finally{clearTimeout(timer);}}
 function total(){return [...bets.values()].reduce((n,b)=>n+b.amount,0);}
 function render(){const locked=busy||!!pending||!snapshot?.canPlay,sum=total(),spin=snapshot?.spin;
  $('#rlName').textContent=snapshot?.user.username||'Votre compte';$('#rlBalance').textContent=snapshot?nf.format(snapshot.user.chips):'—';
  document.querySelectorAll('[data-chip]').forEach(b=>{b.disabled=locked;b.setAttribute('aria-pressed',String(Number(b.dataset.chip)===chip));});
  document.querySelectorAll('[data-bet-key]').forEach(b=>{const value=bets.get(b.dataset.betKey),small=b.querySelector('small');b.disabled=locked;b.setAttribute('aria-pressed',String(!!value));small.hidden=!value;small.textContent=value?nf.format(value.amount):'';b.setAttribute('aria-label',label({type:b.dataset.type,value:['number','dozen','column'].includes(b.dataset.type)?Number(b.dataset.value):b.dataset.value})+(value?' : '+value.amount+' jetons':''));});
  $('#rlStake').textContent=nf.format(sum)+' jeton'+(sum===1?'':'s');$('#rlSpin').disabled=locked||!sum||sum>(snapshot?.user.chips??0);$('#rlSpin').textContent=busy?'La bille tourne…':'Lancer la bille · '+nf.format(sum)+' jetons';$('#rlClear').disabled=locked||!sum;$('#rlUndo').disabled=locked||!undo.length;
  $('#rlSelections').innerHTML=bets.size?[...bets.values()].map(b=>`<li><span>${esc(label(b))}</span><strong>${nf.format(b.amount)}</strong><button class="rl-remove" type="button" data-remove="${key(b)}" aria-label="Retirer la mise ${esc(label(b))}" ${locked?'disabled':''}>×</button></li>`).join(''):'<li class="muted tiny">Aucune mise sélectionnée.</li>';
  $('#rlRetry').hidden=!pending||busy;$('#rlRetry').disabled=busy;$('#rlRefresh').disabled=busy;$('#rlLogin').hidden=!!snapshot;
  $('#rlAccess').textContent=snapshot?.user.isAdmin?'Compte administrateur : gestion uniquement. Utilisez un compte joueur.':snapshot?.pokerTable?'Quittez votre siège de poker avant de jouer.':snapshot?.blackjackActive?'Terminez votre main de blackjack avant de jouer.':snapshot&&sum>snapshot.user.chips?'Le solde ne suffit pas pour les mises sélectionnées.':snapshot&&snapshot.user.chips<10?'Contactez un responsable pour obtenir des jetons.':'';
  $('#rlNumber').textContent=spin?.number??'—';$('#rlColor').textContent=spin?colorName(spin.color):'FAITES VOTRE JEU';$('#rlNumber').className=spin?'rl-result-'+spin.color:'';
  $('#rlResultTitle').textContent=spin?spin.number+' · '+colorName(spin.color):'Le prochain numéro ?';$('#rlResult').textContent=spin?`${spin.net>0?'+':''}${nf.format(spin.net)} jetons nets.`:'Choisissez un jeton, puis vos cases.';
  $('#rlReturn').textContent=spin?'Mise : '+nf.format(spin.stake)+' · Retour total : '+nf.format(spin.returned):'';
  $('#rlRecent').innerHTML=snapshot?.recent.length?snapshot.recent.map(r=>`<span class="rl-history-number rl-${r.color}" title="${r.number} · ${colorName(r.color)} · ${r.net>0?'+':''}${r.net} jetons nets">${r.number}</span>`).join(''):'<span class="muted tiny">Aucun tirage pour le moment.</span>';
  $('.rl-betting').setAttribute('aria-busy',String(busy));
 }
 async function wheel(number,animate=false){if(!Number.isInteger(number))return;const target=(360-order.indexOf(number)*360/37)%360;rotation=animate?rotation+1080+(target-rotation%360+360)%360:target;const disc=$('#rlDisc');disc.style.transition=animate&&!matchMedia('(prefers-reduced-motion:reduce)').matches?'':'none';disc.style.transform='rotate('+rotation+'deg)';if(animate&&!matchMedia('(prefers-reduced-motion:reduce)').matches)await new Promise(r=>setTimeout(r,2200));}
 async function refresh(){if(busy)return;if(!token()){snapshot=null;render();message('Connectez-vous au lobby pour jouer avec vos jetons.');return;}busy=true;render();try{
  snapshot=await api();identity=String(snapshot.user.id);if(!pending){try{const saved=JSON.parse(localStorage.getItem('sor_rl_pending_'+identity)||'null');if(saved?.requestId&&Array.isArray(saved.bets)){pending=saved;bets=new Map(saved.bets.map(b=>[key(b),b]));}}catch{localStorage.removeItem('sor_rl_pending_'+identity);}}
  await wheel(snapshot.spin?.number);message(pending?'Une mise attend confirmation. Reprenez la même demande.':'Faites vos jeux.');
 }catch(e){if(e.status===401){snapshot=null;identity=null;}message(e.message);}finally{busy=false;render();}}
 async function spin(){if(busy||(!pending&&!snapshot?.canPlay))return;busy=true;try{
  if(!pending)storePending({requestId:crypto.randomUUID(),bets:[...bets.values()].map(b=>({...b}))});render();message('Rien ne va plus…');const result=await api('/spin',pending);storePending(null);await wheel(result.spin.number,true);snapshot=result;message('Le tirage est terminé. Votre solde est à jour.');
 }catch(e){if(e.status){storePending(null);message(e.message);try{snapshot=await api();await wheel(snapshot.spin?.number);}catch{}}else message('Confirmation interrompue. Reprenez cette demande : la mise ne sera comptée qu’une fois.');}finally{busy=false;render();}}
 function remember(){undo.push([...bets.values()].map(b=>({...b})));if(undo.length>100)undo.shift();}
 document.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{chip=Number(b.dataset.chip);render();});
 document.querySelectorAll('[data-bet-key]').forEach(b=>b.onclick=()=>{if(busy||pending||!snapshot?.canPlay)return;if(total()+chip>10000){message('Maximum : 10 000 jetons par tirage.');return;}remember();const k=b.dataset.betKey,old=bets.get(k);bets.set(k,{type:b.dataset.type,value:['number','dozen','column'].includes(b.dataset.type)?Number(b.dataset.value):b.dataset.value,amount:(old?.amount||0)+chip});render();});
 $('#rlSelections').onclick=e=>{const b=e.target.closest('[data-remove]');if(b&&!busy&&!pending&&snapshot?.canPlay){remember();bets.delete(b.dataset.remove);render();}};
 $('#rlClear').onclick=()=>{remember();bets.clear();render();};$('#rlUndo').onclick=()=>{if(undo.length)bets=new Map(undo.pop().map(b=>[key(b),b]));render();};$('#rlSpin').onclick=spin;$('#rlRetry').onclick=spin;$('#rlRefresh').onclick=refresh;
 window.addEventListener('storage',e=>{if(e.key==='bw_token')location.reload();});render();refresh();
})();
