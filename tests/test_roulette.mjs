// Moteur/Worker réels ; SQLite en mémoire, jamais de donnée de production.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app/_worker.js',import.meta.url),'utf8');
const {default:worker,rlColor,rlNormalize,rlSettle,bjBegin}=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {rlColor,rlNormalize,rlSettle,bjBegin};').toString('base64'));
const white=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
assert.equal(Array.from({length:37},(_,n)=>rlColor(n)).filter(c=>c==='white').length,18);
assert.equal(Array.from({length:37},(_,n)=>rlColor(n)).filter(c=>c==='black').length,18);assert.equal(rlColor(0),'green');
for(let n=0;n<=36;n++){
 for(let v=0;v<=36;v++){const r=rlSettle([{type:'number',value:v,amount:10}],n);assert.equal(r.returned,n===v?360:0);assert.equal(r.net,r.returned-10);}
 for(const color of ['black','white'])assert.equal(rlSettle([{type:'color',value:color,amount:10}],n).returned,n>0&&((white.includes(n)?'white':'black')===color)?20:0);
 for(const v of ['even','odd'])assert.equal(rlSettle([{type:'parity',value:v,amount:10}],n).returned,n>0&&n%2===(v==='even'?0:1)?20:0);
 for(const v of ['low','high'])assert.equal(rlSettle([{type:'half',value:v,amount:10}],n).returned,n>0&&(v==='low'?n<=18:n>=19)?20:0);
 for(let v=1;v<=3;v++){
  assert.equal(rlSettle([{type:'dozen',value:v,amount:10}],n).returned,n>0&&Math.ceil(n/12)===v?30:0);
  assert.equal(rlSettle([{type:'column',value:v,amount:10}],n).returned,n>0&&(n-1)%3+1===v?30:0);
 }
}
const all=Array.from({length:37},(_,n)=>({type:'number',value:n,amount:10}));
for(let n=0;n<=36;n++)assert.equal(rlSettle(all,n).net,-10);
const mixed=[{type:'number',value:1,amount:10},{type:'color',value:'white',amount:20},{type:'parity',value:'odd',amount:10},{type:'dozen',value:1,amount:10}];
assert.equal(rlSettle(mixed,1).returned,450);assert.equal(rlSettle(mixed,0).returned,0);
assert.deepEqual(rlNormalize(mixed),rlNormalize([...mixed].reverse()));
for(const bets of [null,[],[null],[{type:'color',value:'red',amount:10}],[{type:'color',value:'white',amount:11}],[{type:'number',value:37,amount:10}],[{type:'number',value:'1',amount:10}],[{type:'number',value:1,amount:-10}],[{type:'number',value:1,amount:10,returned:360}],[{type:'half',value:'low',amount:10000},{type:'half',value:'high',amount:10}],[mixed[0],mixed[0]]])assert.throws(()=>rlNormalize(bets));
console.log('PASS moteur : 37 résultats × tous les types, zéro, 18 blancs/18 noirs, paiements 35:1/2:1/1:1, combinaison et validation stricte.');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');let beforeBatch=null;
const DB={prepare(query){return{query,args:[],bind(...args){this.args=args;return this;},async first(){return sql.prepare(query).get(...this.args)||null;},async all(){return{results:sql.prepare(query).all(...this.args)};},async run(){const r=sql.prepare(query).run(...this.args);return{meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}};},async batch(steps){if(beforeBatch)await beforeBatch(steps);sql.exec('BEGIN IMMEDIATE');try{const result=steps.map(s=>{const r=sql.prepare(s.query).run(...s.args);return{meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};});sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const secret=crypto.randomBytes(20).toString('hex'),env={DB,ADMIN_BOOTSTRAP_PASSWORD:secret},id=()=>crypto.randomUUID();
async function req(path,body,token){const r=await worker.fetch(new Request('https://fixture.test/api/'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:await r.json()};}
function ok(r,status=200){assert.equal(r.status,status,JSON.stringify(r.data));return r.data;}
const schema=source.split('const SCHEMA = [')[1].split('];')[0];for(const m of schema.matchAll(/`([^`]+)`/g))if(!m[1].includes('roulette'))sql.exec(m[1]);
sql.prepare('INSERT INTO users(username,password_hash,salt,chips) VALUES(?,?,?,?)').run('Ancien-Fictif','fixture-hash','fixture-salt',37);
const legacy=sql.prepare('SELECT * FROM users').get();
ok(await req('tables'));assert.deepEqual(sql.prepare("SELECT * FROM users WHERE username='Ancien-Fictif'").get(),legacy);assert.equal(sql.prepare('SELECT count(*) n FROM roulette_spins').get().n,0);
const admin=ok(await req('login',{username:'SOR-VARG',password:secret}));
const player=ok(await req('register',{username:'Roulette-Test',password:secret})),other=ok(await req('register',{username:'Roulette-Autre',password:secret}));
const balance=()=>Number(sql.prepare('SELECT chips FROM users WHERE id=?').get(player.user.id).chips);
const credit=(n=10000)=>sql.prepare('UPDATE users SET chips=? WHERE id=?').run(n,player.user.id);
const spin=(bets=all,requestId=id())=>req('roulette/spin',{bets,requestId},player.token);
ok(await req('roulette'),401);ok(await req('roulette/spin',{bets:mixed,requestId:id()},admin.token),403);
ok(await spin(),409);assert.equal(balance(),0);assert.equal(sql.prepare('SELECT count(*) n FROM roulette_spins').get().n,0);
credit();ok(await req('roulette/spin',{bets:mixed,requestId:id(),result:1},player.token),400);ok(await req('roulette/spin',{bets:mixed,requestId:'short'},player.token),400);
const key=id(),first=ok(await spin(all,key));assert.equal(first.spin.net,-10);assert.equal(balance(),9990);assert.equal(first.spin.stake,370);assert.equal(first.spin.returned,360);assert.equal(first.spin.color,rlColor(first.spin.number));
assert.deepEqual(ok(await spin([...all].reverse(),key)).spin,first.spin);assert.equal(balance(),9990);ok(await spin(mixed,key),409);assert.equal(balance(),9990);assert.equal(sql.prepare('SELECT count(*) n FROM roulette_spins').get().n,1);
assert.equal(ok(await req('roulette',undefined,other.token)).recent.length,0);assert.equal(ok(await req('roulette',undefined,other.token)).spin,null);assert.equal(ok(await req('roulette',undefined,player.token)).spin.id,first.spin.id);
console.log('PASS API : migration additive, comptes conservés, connexion et rôle admin, résultat serveur, solde partagé, historique privé et reprise sans double débit.');
// Deux demandes identiques arrivant ensemble n'ont qu'un seul effet.
const duplicate=id(),b=balance();const same=await Promise.all([spin(all,duplicate),spin(all,duplicate)]);same.forEach(r=>ok(r));assert.equal(same[0].data.spin.id,same[1].data.spin.id);assert.equal(balance(),b-10);
// Solde pour un seul tirage : deux requêtes distinctes ne peuvent pas toutes deux dépenser.
credit(370);const race=await Promise.all([spin(),spin()]);assert.equal(race.filter(r=>r.status===200).length,1);assert.equal(race.filter(r=>r.status===409).length,1);assert.equal(balance(),360);
// Deux requêtes distinctes avec assez de solde sont deux parties, chacune une seule fois.
credit();const distinct=await Promise.all([spin(),spin()]);distinct.forEach(r=>ok(r));assert.equal(balance(),9980);
// Siège de poker créé entre la lecture et le batch : solde/historique annulés intégralement.
let count=sql.prepare('SELECT count(*) n FROM roulette_spins').get().n;const money=balance();
beforeBatch=async steps=>{if(steps.some(s=>s.query.includes('INSERT INTO roulette_spins'))){beforeBatch=null;sql.prepare('INSERT INTO table_seats VALUES(?,?,?)').run(1,player.user.id,0);}};
ok(await spin(),409);assert.equal(balance(),money);assert.equal(sql.prepare('SELECT count(*) n FROM roulette_spins').get().n,count);ok(await spin(),409);sql.prepare('DELETE FROM table_seats WHERE user_id=?').run(player.user.id);
// Main BJ créée entre lecture et batch : aucune mise de roulette écrite.
function insertBJ(){const h=bjBegin(10,['8♣','5♣','9♣','6♣']);sql.prepare('INSERT INTO blackjack_hands VALUES(?,?,?,?,?,?,?,?,?)').run(id(),player.user.id,id(),'playing',0,JSON.stringify(h),id(),Date.now(),Date.now());}
beforeBatch=async steps=>{if(steps.some(s=>s.query.includes('INSERT INTO roulette_spins'))){beforeBatch=null;insertBJ();}};
ok(await spin(),409);assert.equal(balance(),money);assert.equal(sql.prepare('SELECT count(*) n FROM roulette_spins').get().n,count);assert.equal(ok(await req('roulette',undefined,player.token)).canPlay,false);ok(await spin(),409);
// Un rejeu déjà réglé reste accessible pendant une autre partie, sans débit.
assert.equal(ok(await spin(all,key)).spin.id,first.spin.id);assert.equal(balance(),money);sql.prepare('DELETE FROM blackjack_hands WHERE user_id=?').run(player.user.id);
for(let n=0;n<12;n++)ok(await spin());const history=ok(await req('roulette',undefined,player.token));assert.equal(history.recent.length,10);assert.equal(history.user.chips,balance());assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);sql.close();
console.log('PASS concurrence : double envoi, solde insuffisant, courses avec poker/BJ, annulation atomique, reprise d’un tirage et historique des dix derniers.');
