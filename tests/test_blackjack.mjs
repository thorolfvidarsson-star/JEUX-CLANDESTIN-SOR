// Moteur réel + API réelle, D1 remplacée seulement par SQLite en mémoire.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
const code=readFileSync(new URL('../app/_worker.js',import.meta.url),'utf8');
const {default:worker,bjScore,bjBegin,bjPlay,bjPublic,bjShoe}=await import('data:text/javascript;base64,'+Buffer.from(code+'\nexport {bjScore,bjBegin,bjPlay,bjPublic,bjShoe};').toString('base64'));
const requestId=()=>crypto.randomUUID();
const shoe=(...draws)=>draws.reverse();
const hand=(...draws)=>bjBegin(10,shoe(...draws));
assert.deepEqual(bjScore(['A♠','A♥','9♠']),{total:21,soft:true,natural:false});
assert.deepEqual(bjScore(['A♠','9♥','5♠']),{total:15,soft:false,natural:false});
assert.equal(hand('A♠','9♠','K♠','8♠').returned,25);
assert.equal(hand('A♠','A♥','K♠','K♥').returned,10);
assert.equal(hand('9♠','A♥','8♠','K♥').outcome,'dealer_blackjack');
const soft17=hand('10♠','A♥','8♠','6♥');
assert.equal(bjPlay(soft17,'stand').state.outcome,'win');
assert.equal(bjPlay(soft17,'stand').state.dealer.length,2);
assert.equal(bjPlay(hand('10♠','10♥','8♠','8♥'),'stand').state.returned,10);
assert.equal(bjPlay(hand('10♠','10♥','8♠','9♥'),'stand').state.returned,0);
assert.equal(bjPlay(hand('10♠','10♥','8♠','6♥','K♣'),'stand').state.returned,20);
assert.equal(bjPlay(hand('10♠','10♥','8♠','6♥','K♣'),'hit').state.outcome,'bust');
const initial=hand('5♠','9♥','6♠','8♥','K♣'),doubled=bjPlay(initial,'double');
assert.equal(doubled.wagered,10);assert.equal(doubled.state.stake,20);assert.equal(doubled.state.returned,40);assert.equal(doubled.state.outcome,'win');assert.equal(initial.player.length,2);
const three=bjPlay(hand('2♠','9♥','3♠','8♥','2♣'),'hit').state;
assert.throws(()=>bjPlay(three,'double'),/deux premières cartes/);
assert.throws(()=>bjPlay(doubled.state,'stand'),/terminée/);
const visible=bjPublic({id:'fixture',revision:0,state_json:JSON.stringify(soft17),updated_at:1});
assert.deepEqual(visible.dealer,['A♥',null]);assert.equal(visible.dealerTotal,null);assert.ok(!('shoe' in visible));assert.ok(!JSON.stringify(visible).includes('6♥'));
for(let i=0;i<40;i++){const deck=bjShoe(),counts={};assert.equal(deck.length,312);for(const c of deck)counts[c]=(counts[c]||0)+1;assert.equal(Object.keys(counts).length,52);assert.ok(Object.values(counts).every(n=>n===6));}
console.log('PASS moteur : as, blackjack 3:2, égalité, pertes, dépassement, double, croupier soft 17, confidentialité et 6 jeux complets.');

const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
let beforeBatch=null,beforeRun=null;
const DB={prepare(query){return{query,args:[],bind(...args){this.args=args;return this;},async first(){return sql.prepare(query).get(...this.args)||null;},async all(){return{results:sql.prepare(query).all(...this.args)};},async run(){if(beforeRun)await beforeRun(this);const r=sql.prepare(query).run(...this.args);return{meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}};},async batch(steps){if(beforeBatch)await beforeBatch(steps);sql.exec('BEGIN IMMEDIATE');try{const out=steps.map(s=>{const r=sql.prepare(s.query).run(...s.args);return{meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};});sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const secret=crypto.randomBytes(20).toString('hex'),env={DB,ADMIN_BOOTSTRAP_PASSWORD:secret};
async function req(path,body,token){const response=await worker.fetch(new Request('https://fixture.test/api/'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined}),env);return{status:response.status,data:await response.json()};}
function ok(response,status=200){assert.equal(response.status,status,JSON.stringify(response.data));return response.data;}
// Migration additive depuis les seules tables historiques du poker.
const schemaBlock=code.split('const SCHEMA = [')[1].split('];')[0];
for(const match of schemaBlock.matchAll(/`([^`]+)`/g))if(!match[1].includes('blackjack'))sql.exec(match[1]);
sql.prepare('INSERT INTO users(username,password_hash,salt,chips) VALUES(?,?,?,?)').run('Ancien-Compte','fixture-hash','fixture-salt',37);
sql.prepare("INSERT INTO settings VALUES('active_tables','4'),('min_bet','12')").run();
sql.prepare("INSERT INTO tables_state(id,name,state_json) VALUES(1,'Table 01','{}')").run();
const oldUser=sql.prepare("SELECT * FROM users WHERE username='Ancien-Compte'").get();
const admin=ok(await req('login',{username:'SOR-VARG',password:secret}));
assert.deepEqual(sql.prepare("SELECT * FROM users WHERE username='Ancien-Compte'").get(),oldUser);
assert.equal(sql.prepare("SELECT value FROM settings WHERE key='active_tables'").get().value,'4');
assert.equal(sql.prepare("SELECT count(*) n FROM blackjack_hands").get().n,0);
sql.exec("UPDATE settings SET value='6' WHERE key='active_tables'; UPDATE settings SET value='10' WHERE key='min_bet'");
console.log('PASS mise à jour : ancien compte, solde, hachage, paramètres et table conservés lors de l’ajout du blackjack.');

const p=ok(await req('register',{username:'Test-BJ',password:secret})),other=ok(await req('register',{username:'Test-Other',password:secret}));
const balance=()=>Number(sql.prepare('SELECT chips FROM users WHERE id=?').get(p.user.id).chips);
const live=()=>sql.prepare("SELECT * FROM blackjack_hands WHERE user_id=? AND status='playing'").get(p.user.id);
function credit(n=1000){sql.prepare('UPDATE users SET chips=? WHERE id=?').run(n,p.user.id);}
// Installation de mains déterministes uniquement dans la base jetable de test.
function seed(state){sql.prepare('DELETE FROM blackjack_hands WHERE user_id=?').run(p.user.id);const id=requestId();sql.prepare('INSERT INTO blackjack_hands VALUES(?,?,?,?,?,?,?,?,?)').run(id,p.user.id,requestId(),state.status,0,JSON.stringify(state),requestId(),Date.now(),Date.now());return{id,revision:0};}
const act=(h,action,key=requestId())=>req('blackjack/'+action,{handId:h.id,revision:h.revision,requestId:key},p.token);
ok(await req('blackjack'),401);ok(await req('blackjack/start',{bet:10,requestId:requestId()},admin.token),403);
ok(await req('blackjack/start',{bet:10,requestId:requestId()},p.token),409);assert.equal(balance(),0);assert.equal(sql.prepare('SELECT count(*) n FROM blackjack_hands').get().n,0);
credit();for(const bet of [9,11,10002,10.5,'10'])ok(await req('blackjack/start',{bet,requestId:requestId()},p.token),400);
ok(await req('blackjack/start',{bet:10,requestId:requestId(),shoe:['A♠']},p.token),400);
const start={bet:10,requestId:requestId()},started=ok(await req('blackjack/start',start,p.token));
assert.equal(balance(),1000-10+(started.hand.returned||0));const oldBalance=balance();
assert.deepEqual(ok(await req('blackjack/start',start,p.token)).hand,started.hand);assert.equal(balance(),oldBalance);
ok(await req('blackjack/start',{...start,bet:20},p.token),409);
assert.equal(sql.prepare('SELECT count(*) n FROM blackjack_events').get().n,1);
console.log('PASS API mises : accès, administrateur, validation, solde insuffisant, aucune pioche client, débit unique et répétition idempotente.');

let h=seed(initial);credit(990);let actionKey=requestId();const paid=ok(await act(h,'double',actionKey));assert.equal(balance(),1020);assert.equal(paid.hand.stake,20);assert.equal(paid.hand.returned,40);
ok(await act(h,'double',actionKey));assert.equal(balance(),1020);ok(await act(h,'stand',actionKey),409);ok(await act(h,'stand'),409);assert.equal(balance(),1020);
h=seed(initial);credit(5);const before=sql.prepare('SELECT * FROM blackjack_hands WHERE id=?').get(h.id);ok(await act(h,'double'),409);assert.equal(balance(),5);assert.deepEqual(sql.prepare('SELECT * FROM blackjack_hands WHERE id=?').get(h.id),before);assert.equal(sql.prepare('SELECT count(*) n FROM blackjack_events').get().n,0);
h=seed(hand('2♠','9♥','3♠','8♥','2♣','3♣'));credit();const hit=ok(await act(h,'hit'));assert.equal(balance(),1000);assert.equal(hit.hand.playerTotal,7);assert.equal(hit.hand.revision,1);ok(await act(h,'stand'),409);ok(await act({...h,revision:1},'double'),409);
ok(await req('blackjack/stand',{handId:h.id,revision:1,requestId:requestId()},other.token),404);
const restored=ok(await req('blackjack',undefined,p.token));assert.equal(restored.hand.id,h.id);assert.equal(restored.hand.playerTotal,7);assert.equal(restored.hand.dealer[1],null);assert.equal(ok(await req('blackjack',undefined,other.token)).hand,null);
console.log('PASS règlement : double crédité une fois, remboursement, manque de solde annulé intégralement, révision périmée refusée, reprise et main privée.');

// Deux décisions provenant de deux onglets : une seule doit être validée.
h=seed(initial);credit(990);const decisions=await Promise.all([act(h,'double'),act(h,'stand')]);assert.equal(decisions.filter(r=>r.status===200).length,1);assert.equal(decisions.filter(r=>r.status===409).length,1);assert.equal(balance(),1020);assert.equal(sql.prepare('SELECT count(*) n FROM blackjack_events').get().n,1);
// Demandes identiques simultanées ne créent qu'une écriture.
h=seed(initial);credit(990);actionKey=requestId();const duplicates=await Promise.all([act(h,'double',actionKey),act(h,'double',actionKey)]);duplicates.forEach(r=>ok(r));assert.equal(balance(),1020);assert.equal(sql.prepare('SELECT count(*) n FROM blackjack_events').get().n,1);
// Départ concurrent d'une autre main entre lecture et batch de start.
sql.prepare('DELETE FROM blackjack_hands WHERE user_id=?').run(p.user.id);credit();
beforeBatch=async steps=>{if(steps[0].query.includes('UPDATE users SET chips=chips+?')){beforeBatch=null;seed(initial);}};
ok(await req('blackjack/start',{bet:10,requestId:requestId()},p.token),409);assert.equal(balance(),1000);assert.equal(sql.prepare('SELECT count(*) n FROM blackjack_events').get().n,0);
console.log('PASS concurrence : deux décisions, répétition parallèle et conflit de départ sans double débit ni double paiement.');

ok(await req('join',{tableId:1},p.token),409);
ok(await req('admin/user',{id:p.user.id,username:'Test-BJ',chips:500},admin.token),409);
ok(await req('admin/user/delete',{id:p.user.id},admin.token),409);
assert.ok(ok(await req('admin',undefined,admin.token)).users.find(u=>u.id===p.user.id).seated);
sql.prepare('DELETE FROM blackjack_hands WHERE user_id=?').run(p.user.id);credit();ok(await req('join',{tableId:1},p.token));const seatedBalance=balance();ok(await req('blackjack/start',{bet:10,requestId:requestId()},p.token),409);assert.equal(balance(),seatedBalance);ok(await req('leave',{tableId:1},p.token));
// Le siège apparaît après la pré-vérification blackjack : toute la mise est annulée.
beforeBatch=async steps=>{if(steps.some(s=>s.query.includes('INSERT INTO blackjack_hands'))){beforeBatch=null;sql.prepare('INSERT INTO table_seats VALUES(?,?,?)').run(1,p.user.id,0);}};
ok(await req('blackjack/start',{bet:10,requestId:requestId()},p.token),409);assert.equal(balance(),seatedBalance);sql.prepare('DELETE FROM table_seats WHERE user_id=?').run(p.user.id);
// Une main BJ apparaît avant le commit poker : trigger -> rollback du commit poker.
beforeBatch=async steps=>{if(steps.some(s=>s.query.includes('INSERT INTO table_seats'))){beforeBatch=null;seed(initial);}};
const tableBefore=sql.prepare('SELECT state_json FROM tables_state WHERE id=1').get().state_json;
ok(await req('join',{tableId:1},p.token),409);assert.equal(balance(),seatedBalance);assert.equal(sql.prepare('SELECT count(*) n FROM table_seats WHERE user_id=?').get(p.user.id).n,0);assert.equal(sql.prepare('SELECT state_json FROM tables_state WHERE id=1').get().state_json,tableBefore);
// Un lancement entre le contrôle admin et l'UPDATE ne doit pas écraser le solde.
sql.prepare('DELETE FROM blackjack_hands WHERE user_id=?').run(p.user.id);
beforeRun=async step=>{if(step.query.startsWith('UPDATE users SET username=?,chips=?')){beforeRun=null;seed(initial);}};
ok(await req('admin/user',{id:p.user.id,username:'Test-BJ',chips:9999},admin.token),409);assert.equal(balance(),seatedBalance);
sql.prepare('DELETE FROM blackjack_hands WHERE user_id=?').run(p.user.id);
beforeRun=async step=>{if(step.query.startsWith('DELETE FROM users WHERE id=? AND is_admin=0')){beforeRun=null;seed(initial);}};
ok(await req('admin/user/delete',{id:p.user.id},admin.token),409);assert.equal(balance(),seatedBalance);ok(await req('me',undefined,p.token));
assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);sql.close();
console.log('PASS intégrité : exclusion poker/blackjack dans les deux sens y compris courses, administration bloquée en jeu, aucune donnée perdue.');
