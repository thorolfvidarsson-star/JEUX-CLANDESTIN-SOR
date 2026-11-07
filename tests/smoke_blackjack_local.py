"""Parcours navigateur + Worker/D1 Cloudflare réels en local, base jetable."""
from pathlib import Path
import json,os,secrets,shutil,socket,subprocess,tempfile,time,uuid
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
out=root/'livraison/1.2.0-sor-roulette';out.mkdir(parents=True,exist_ok=True)
tmp=Path(tempfile.mkdtemp(prefix='sor-bj-local-'));server=None;secret=secrets.token_urlsafe(24);cases=[]
try:
 sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base='http://127.0.0.1:'+str(port)
 with (tmp/'workerd.log').open('w') as log:
  server=subprocess.Popen([os.environ.get('SOR_WRANGLER_BIN','wrangler'),'pages','dev',str(root/'deploy'),'--d1','DB','--binding','ADMIN_BOOTSTRAP_PASSWORD='+secret,'--ip','127.0.0.1','--port',str(port),'--inspector-port','0','--persist-to',str(tmp/'state'),'--compatibility-date','2026-10-28','--show-interactive-dev-session','false'],cwd=tmp,env={**os.environ,'WRANGLER_SEND_METRICS':'false','XDG_CONFIG_HOME':str(tmp/'config')},stdout=log,stderr=log)
  with sync_playwright() as p:
   request=p.request.new_context()
   for _ in range(150):
    if server.poll() is not None:raise RuntimeError('Serveur arrêté : '+(tmp/'workerd.log').read_text()[-1500:])
    try:
     if request.get(base+'/api/health',timeout=1000).status==200:break
    except Exception:pass
    time.sleep(.2)
   def api(path,body=None,token=None,status=200):
    headers={'authorization':'Bearer '+token} if token else {}
    r=request.post(base+'/api/'+path,data=body,headers=headers) if body is not None else request.get(base+'/api/'+path,headers=headers)
    assert r.status==status,(path,r.status,r.text());return r.json()
   admin=api('login',{'username':'SOR-VARG','password':secret})
   browser=p.chromium.launch(headless=True,executable_path=os.environ.get('SOR_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
   for width in [320,390,1366]:
    player=api('register',{'username':'Blackjack-'+str(width),'password':secrets.token_urlsafe(18)});token=player['token'];uid=player['user']['id']
    api('admin/user',{'id':uid,'username':player['user']['username'],'chips':5000},admin['token'])
    c=browser.new_context(viewport={'width':width,'height':850 if width<800 else 1000},is_mobile=width<800,has_touch=width<800,service_workers='block');page=c.new_page();errors=[];posts=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:posts.append(r.url) if '/api/blackjack/' in r.url and r.method=='POST' else None)
    page.goto(base,wait_until='networkidle');expect(page.locator('#tables .table-card')).to_have_count(6);expect(page.locator('.game-choice-grid .game-choice')).to_have_count(3);page.evaluate('document.fonts.ready');assert page.evaluate('document.fonts.check("800 16px SorClub")');assert page.locator('.sor-reaper').evaluate('e=>e.complete&&e.naturalWidth>0');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');page.screenshot(path=str(out/('LOBBY_'+str(width)+'.png')),full_page=True)
    page.locator('.game-choice[href="./blackjack.html"]').click();expect(page.locator('#bjLogin')).to_be_visible();expect(page.locator('#bjDeal')).to_be_disabled();page.evaluate('(t)=>localStorage.setItem("bw_token",t)',token);page.reload();expect(page.locator('#bjBalance')).to_have_text('5\u202f000');expect(page.locator('#bjDeal')).to_be_enabled()
    page.locator('[data-bet="100"]').click();expect(page.locator('#bjBet')).to_have_value('100');page.locator('#bjDeal').click();expect(page.locator('#bjStake')).to_contain_text('100');expect(page.locator('#bjPhase')).not_to_have_text('Prenez place');
    # Éviter seulement un blackjack naturel pour les gestes à tester : parties réelles.
    for _ in range(20):
     current=api('blackjack',token=token)
     if current['hand']['status']=='playing':break
     expect(page.locator('#bjDeal')).to_be_enabled();page.locator('#bjDeal').click();expect(page.locator('#bjMessage')).not_to_contain_text('prépare',timeout=10000)
    assert current['hand']['status']=='playing';hid=current['hand']['id'];balance=current['user']['chips'];assert current['hand']['dealer'][1] is None;assert 'shoe' not in current['hand'];page.reload();expect(page.locator('#bjActions')).to_be_visible();assert api('blackjack',token=token)['hand']['id']==hid;assert api('me',token=token)['user']['chips']==balance
    page.evaluate('scrollTo(0,0)');page.screenshot(path=str(out/('BLACKJACK_'+str(width)+'.png')),full_page=True);page.locator('#bjHit').click();expect(page.locator('#bjMessage')).not_to_contain_text('prépare');state=api('blackjack',token=token)
    if state['hand']['status']=='playing':expect(page.locator('#bjDouble')).to_be_disabled();page.locator('#bjStand').click();expect(page.locator('#bjActions')).to_be_hidden()
    else:expect(page.locator('#bjActions')).to_be_hidden()
    result=api('blackjack',token=token);assert result['hand']['status']=='settled';assert result['hand']['dealer'][1] is not None;assert api('me',token=token)['user']['chips']==result['user']['chips'];expect(page.locator('#bjHistory li')).not_to_have_count(0)
    # Doubler par l'interface sur une nouvelle main.
    for _ in range(30):
     page.locator('#bjDeal').click();expect(page.locator('#bjMessage')).not_to_contain_text('prépare');state=api('blackjack',token=token)
     if state['hand']['status']=='playing':break
    assert state['hand']['status']=='playing';expect(page.locator('#bjDouble')).to_be_enabled();page.locator('#bjDouble').click();expect(page.locator('#bjActions')).to_be_hidden();assert api('blackjack',token=token)['hand']['doubled'];expect(page.locator('#bjStake')).to_contain_text(str(state['hand']['bet']*2));page.reload();expect(page.locator('#bjStake')).to_contain_text(str(state['hand']['bet']*2))
    # Le serveur valide une mise mais le navigateur perd la réponse : reprise sans second débit.
    held=[]
    def lose_response(route):
     response=route.fetch();held.append(response.json());route.abort('connectionfailed')
    page.route('**/api/blackjack/start',lose_response);before=len(posts);page.locator('#bjDeal').click();expect(page.locator('#bjRetry')).to_be_visible();after=api('blackjack',token=token);assert len(held)==1;key=page.evaluate('(id)=>JSON.parse(localStorage.getItem("sor_bj_pending_"+id)).body.requestId',uid);assert key;page.unroute('**/api/blackjack/start');page.reload();expect(page.locator('#bjRetry')).to_be_visible();page.locator('#bjRetry').click();expect(page.locator('#bjRetry')).to_be_hidden();replayed=api('blackjack',token=token);assert replayed['user']['chips']==after['user']['chips'];assert replayed['hand']['id']==after['hand']['id'];assert len(posts)==before+2
    if replayed['hand']['status']=='playing':page.locator('#bjStand').click();expect(page.locator('#bjActions')).to_be_hidden()
    page.locator('.bj-rules summary').click();expect(page.locator('.bj-rules')).to_have_attribute('open','');page.evaluate('scrollTo(0,0)');page.screenshot(path=str(out/('BLACKJACK_RESULT_'+str(width)+'.png')),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');assert page.locator('#bjStand').evaluate('e=>getComputedStyle(e).minHeight')=='48px' if width<800 else True
    assert not errors,errors;c.close();cases.append({'width':width,'real_local_d1':True,'lobby_six_poker_tables':True,'biker_local_font_loaded':True,'hit_stand_double':True,'reload_active_and_finished_hand':True,'shared_balance':True,'lost_response_replayed_once':True,'horizontal_overflow':False,'result':'PASS'});print('PASS blackjack interface',width,flush=True)
   # Contrôle admin : même page mais impossible de miser.
   c=browser.new_context(service_workers='block');page=c.new_page();page.goto(base+'/blackjack.html');page.evaluate('(t)=>localStorage.setItem("bw_token",t)',admin['token']);page.reload();expect(page.locator('#bjAccess')).to_contain_text('administrateur');expect(page.locator('#bjDeal')).to_be_disabled();c.close()
   # Poker multijoueur réel : deux comptes, main démarrée, action puis retour des deux sièges.
   players=[]
   for n in [1,2]:
    u=api('register',{'username':'Poker-Test-'+str(n),'password':secrets.token_urlsafe(18)});api('admin/user',{'id':u['user']['id'],'username':u['user']['username'],'chips':1000},admin['token']);api('join',{'tableId':1,'maxPlayers':2},u['token']);players.append(u)
   table=api('table?id=1',token=players[0]['token'])['table'];assert table.get('hand'),table
   for width in [390,1366]:
    c=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<800,has_touch=width<800,service_workers='block');page=c.new_page();game_errors=[];page.on('pageerror',lambda e:game_errors.append(str(e)));page.goto(base);page.evaluate('(t)=>localStorage.setItem("bw_token",t)',players[0]['token']);page.goto(base+'/game.html?id=1',wait_until='networkidle');expect(page.locator('#gameTitle')).to_have_text('Table 01');expect(page.locator('#openHand')).to_be_visible();page.locator('#openHand').click();expect(page.locator('#handDialog')).to_be_visible();expect(page.locator('#popupCards .bw-card')).to_have_count(2);page.locator('#closeHand').click();assert not game_errors,game_errors;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+3');page.evaluate('scrollTo(0,0)');page.screenshot(path=str(out/('POKER_'+str(width)+'.png')),full_page=True);c.close()
   # Le joueur au tour courant se couche : règlement simple du moteur existant.
   who=next(u for u in players if u['user']['id']==table['turn'])
   api('action',{'tableId':1,'action':'fold'},who['token'])
   for u in players:api('leave',{'tableId':1},u['token'])
   assert len(api('tables')['tables'])==6
   # Le service worker inclut les nouveaux fichiers, jamais les données API.
   c=browser.new_context();page=c.new_page();page.goto(base,wait_until='networkidle');page.evaluate("navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>true)");page.reload(wait_until='networkidle');assert page.evaluate("caches.keys()")==['sor-v1.2.0'];cache_urls=page.evaluate("caches.open('sor-v1.2.0').then(c=>c.keys()).then(rs=>rs.map(r=>r.url))");assert any('/blackjack.html' in u for u in cache_urls);assert any('/club-heading.woff' in u for u in cache_urls);assert not any('/api/' in u for u in cache_urls);page.goto(base+'/blackjack.html',wait_until='networkidle');expect(page.locator('#bjLogin')).to_be_visible();c.close()
   browser.close();request.dispose()
 (out/'VALIDATION_BLACKJACK.json').write_text(json.dumps({'version':'1.2.0-sor-roulette','cases':cases,'poker_two_players_fold_settlement':'PASS','admin_manage_only':'PASS','poker_ui_widths':[390,1366],'service_worker_static_only':'PASS','physical_android_tested':False,'actual_fivem_tested':False,'production_deployed':False,'real_data_changed':False},ensure_ascii=False,indent=2)+'\n')
 print('PASS blackjack local et poker multijoueur, aucune production utilisée.')
finally:
 if server is not None:
  server.terminate()
  try:server.wait(timeout=10)
  except subprocess.TimeoutExpired:server.kill();server.wait()
 shutil.rmtree(tmp)
