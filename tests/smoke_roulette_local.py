"""Roulette noir/blanc : vrai runtime Cloudflare workerd/D1 local, base jetable."""
from pathlib import Path
import json,os,secrets,shutil,socket,subprocess,tempfile,time
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'livraison/1.2.0-sor-roulette';out.mkdir(parents=True,exist_ok=True)
tmp=Path(tempfile.mkdtemp(prefix='sor-roulette-local-'));server=None;secret=secrets.token_urlsafe(24);cases=[]
try:
 sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base='http://127.0.0.1:'+str(port)
 with (tmp/'workerd.log').open('w') as log:
  server=subprocess.Popen([os.environ.get('SOR_WRANGLER_BIN','wrangler'),'pages','dev',str(root/'deploy'),'--d1','DB','--binding','ADMIN_BOOTSTRAP_PASSWORD='+secret,'--ip','127.0.0.1','--port',str(port),'--inspector-port','0','--persist-to',str(tmp/'state'),'--compatibility-date','2026-10-28','--show-interactive-dev-session','false'],cwd=tmp,env={**os.environ,'WRANGLER_SEND_METRICS':'false','XDG_CONFIG_HOME':str(tmp/'config')},stdout=log,stderr=log)
  with sync_playwright() as p:
   request=p.request.new_context()
   for _ in range(150):
    if server.poll() is not None:raise RuntimeError((tmp/'workerd.log').read_text()[-1500:])
    try:
     if request.get(base+'/api/health',timeout=1000).status==200:break
    except Exception:pass
    time.sleep(.2)
   def api(path,body=None,token=None,status=200):
    headers={'authorization':'Bearer '+token} if token else {};r=request.post(base+'/api/'+path,data=body,headers=headers) if body is not None else request.get(base+'/api/'+path,headers=headers)
    assert r.status==status,(path,r.status,r.text());return r.json()
   admin=api('login',{'username':'SOR-VARG','password':secret})
   browser=p.chromium.launch(headless=True,executable_path=os.environ.get('SOR_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
   for width in json.loads(os.environ.get('SOR_ROULETTE_WIDTHS','[320,390,1366]')):
    u=api('register',{'username':'Roulette-'+str(width),'password':secrets.token_urlsafe(18)});token=u['token'];api('admin/user',{'id':u['user']['id'],'username':u['user']['username'],'chips':5000},admin['token'])
    c=browser.new_context(viewport={'width':width,'height':850 if width<800 else 1000},has_touch=width<800,is_mobile=width<800,service_workers='block');page=c.new_page();errors=[];posts=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:posts.append(r.url) if r.method=='POST' and '/api/roulette/' in r.url else None)
    page.goto(base,wait_until='networkidle');expect(page.locator('.game-choice-grid .game-choice')).to_have_count(3);expect(page.locator('#tables .table-card')).to_have_count(6);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');page.evaluate('scrollTo(0,0)');page.screenshot(path=str(out/('LOBBY_ROULETTE_'+str(width)+'.png')),full_page=True)
    page.locator('a.roulette-choice').click();expect(page.locator('#rlLogin')).to_be_visible();expect(page.locator('#rlSpin')).to_be_disabled();page.evaluate('(t)=>localStorage.setItem("bw_token",t)',token);page.reload();expect(page.locator('#rlBalance')).to_have_text('5\u202f000');expect(page.locator('[data-bet-key="color:black"]')).to_be_enabled();expect(page.locator('[data-bet-key="color:white"]')).to_have_text('BLANC');assert page.locator('[data-bet-key="color:red"]').count()==0;expect(page.locator('.rl-pocket')).to_have_count(37);expect(page.locator('.rl-pocket.rl-white')).to_have_count(18);expect(page.locator('.rl-pocket.rl-black')).to_have_count(18);expect(page.locator('.rl-pocket.rl-green')).to_have_count(1)
    white=page.locator('[data-bet-key="color:white"]');black=page.locator('[data-bet-key="color:black"]')
    if width==1366:white.focus();page.keyboard.press('Enter')
    else:white.tap()
    expect(page.locator('#rlStake')).to_have_text('10 jetons');black.click();expect(page.locator('#rlStake')).to_have_text('20 jetons');page.locator('#rlUndo').click();expect(page.locator('#rlStake')).to_have_text('10 jetons');page.locator('[data-chip="50"]').click();black.click();expect(page.locator('#rlStake')).to_have_text('60 jetons');page.locator('[data-remove="color:black"]').click();expect(page.locator('#rlStake')).to_have_text('10 jetons');assert not posts;page.locator('#rlClear').click();expect(page.locator('#rlStake')).to_have_text('0 jetons')
    page.locator('[data-chip="10"]').click()
    if not page.locator('#rlNumbersPanel').evaluate('e=>e.open'):page.locator('#rlNumbersPanel summary').click()
    for n in range(37):page.locator('[data-bet-key="number:'+str(n)+'"]').click()
    expect(page.locator('#rlStake')).to_have_text('370 jetons');expect(page.locator('#rlSelections li')).to_have_count(37);page.locator('#rlSpin').click();expect(page.locator('#rlSpin')).to_be_disabled();expect(page.locator('[data-chip="50"]')).to_be_disabled();expect(page.locator('#rlMessage')).to_contain_text('tirage est terminé',timeout=15000)
    state=api('roulette',token=token);assert state['spin']['stake']==370 and state['spin']['returned']==360 and state['spin']['net']==-10;assert state['user']['chips']==4990;expect(page.locator('#rlNumber')).to_have_text(str(state['spin']['number']));expect(page.locator('#rlBalance')).to_have_text('4\u202f990');assert len(posts)==1
    order=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];angle=float(page.locator('#rlDisc').evaluate('e=>e.style.transform').split('(')[1].split('deg')[0]);offset=(angle+order.index(state['spin']['number'])*360/37)%360;assert min(offset,360-offset)<.01
    page.reload();expect(page.locator('#rlNumber')).to_have_text(str(state['spin']['number']));expect(page.locator('#rlStake')).to_have_text('0 jetons');assert api('roulette',token=token)['spin']['id']==state['spin']['id']
    if page.locator('#rlNumbersPanel').evaluate('e=>e.open'):page.locator('#rlNumbersPanel summary').click()
    # Une mise validée dont la réponse se perd est rejouée, même après rechargement.
    page.locator('[data-bet-key="color:black"]').click();held=[]
    def lose_response(route):
     r=route.fetch();held.append(r.json());route.abort('connectionfailed')
    page.route('**/api/roulette/spin',lose_response);page.locator('#rlSpin').click();expect(page.locator('#rlRetry')).to_be_visible();assert len(held)==1;after=api('roulette',token=token);page.unroute('**/api/roulette/spin')
    if width==1366:api('join',{'tableId':1},token)
    page.reload();expect(page.locator('#rlRetry')).to_be_visible();page.locator('#rlRetry').click();expect(page.locator('#rlMessage')).to_contain_text('tirage est terminé',timeout=15000);expect(page.locator('#rlRetry')).to_be_hidden();replay=api('roulette',token=token);assert replay['spin']['id']==after['spin']['id'];assert replay['user']['chips']==after['user']['chips'];assert page.evaluate('(id)=>localStorage.getItem("sor_rl_pending_"+id)',u['user']['id']) is None
    if width==1366:api('leave',{'tableId':1},token);page.locator('#rlRefresh').click();expect(black).to_be_enabled()
    # Interdiction d'une nouvelle mise pendant une place de poker ou une main BJ.
    api('join',{'tableId':1},token);page.locator('#rlRefresh').click();expect(page.locator('#rlAccess')).to_contain_text('siège de poker');expect(black).to_be_disabled();api('leave',{'tableId':1},token)
    for _ in range(20):
     import uuid
     bj=api('blackjack/start',{'bet':10,'requestId':str(uuid.uuid4())},token)
     if bj['hand']['status']=='playing':break
    assert bj['hand']['status']=='playing';page.locator('#rlRefresh').click();expect(page.locator('#rlAccess')).to_contain_text('blackjack');expect(black).to_be_disabled();api('blackjack/stand',{'handId':bj['hand']['id'],'revision':bj['hand']['revision'],'requestId':str(uuid.uuid4())},token);page.locator('#rlRefresh').click();expect(black).to_be_enabled()
    page.locator('.bj-rules summary').click();expect(page.locator('.bj-rules')).to_have_attribute('open','');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');assert not errors,errors;page.locator('.bj-rules summary').click();page.evaluate('scrollTo(0,0)');page.screenshot(path=str(out/('ROULETTE_'+str(width)+'.png')),full_page=True);cases.append({'width':width,'result':'PASS','black_white_green':True,'chips_undo_remove_clear':True,'all_37_numbers_and_return':True,'wheel_matches_server_number':True,'shared_balance_reload':True,'lost_response_replay_once':True,'poker_blackjack_exclusion':True,'horizontal_overflow':False});print('PASS roulette interface',width,flush=True);c.close()
   c=browser.new_context(service_workers='block');page=c.new_page();page.goto(base+'/roulette.html');page.evaluate('(t)=>localStorage.setItem("bw_token",t)',admin['token']);page.reload();expect(page.locator('#rlAccess')).to_contain_text('administrateur');expect(page.locator('[data-bet-key="color:white"]')).to_be_disabled();c.close()
   browser.close();request.dispose()
 (out/'VALIDATION_ROULETTE.json').write_text(json.dumps({'version':'1.2.0-sor-roulette','local_workerd_d1':True,'cases':cases,'admin_manage_only':True,'physical_android_tested':False,'actual_fivem_tested':False,'production_deployed':False,'real_data_changed':False},ensure_ascii=False,indent=2)+'\n');print('PASS roulette noir/blanc sur runtime Cloudflare et D1 locaux.')
finally:
 if server is not None:
  server.terminate()
  try:server.wait(timeout=10)
  except subprocess.TimeoutExpired:server.kill();server.wait()
 shutil.rmtree(tmp)
