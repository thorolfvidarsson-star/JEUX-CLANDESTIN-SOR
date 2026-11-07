"""Initialisation SOR-VARG sur workerd/D1 locale jetable ; aucun accès à la production."""
from pathlib import Path
import json,os,secrets,shutil,socket,subprocess,tempfile,time
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
out=root/'livraison/1.2.0-sor-roulette/admin';out.mkdir(parents=True,exist_ok=True)
tmp=Path(tempfile.mkdtemp(prefix='sor-admin-local-'));server=None;secret=secrets.token_urlsafe(24)
try:
 sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base='http://127.0.0.1:'+str(port)
 with (tmp/'workerd.log').open('w') as log:
  server=subprocess.Popen([os.environ.get('SOR_WRANGLER_BIN','wrangler'),'pages','dev',str(root/'deploy'),'--d1','DB','--binding','ADMIN_BOOTSTRAP_PASSWORD='+secret,'--ip','127.0.0.1','--port',str(port),'--inspector-port','0','--persist-to',str(tmp/'state'),'--compatibility-date','2026-10-28','--show-interactive-dev-session','false'],cwd=tmp,env={**os.environ,'WRANGLER_SEND_METRICS':'false','XDG_CONFIG_HOME':str(tmp/'config')},stdout=log,stderr=log)
  with sync_playwright() as p:
   request=p.request.new_context();ready=False
   for _ in range(150):
    if server.poll() is not None:raise RuntimeError('Serveur local arrêté : '+(tmp/'workerd.log').read_text()[-1800:])
    try:
     response=request.get(base+'/api/health',timeout=1000)
     if response.status==200:ready=True;break
    except Exception:pass
    time.sleep(.2)
   assert ready,'Serveur local non prêt';health=request.get(base+'/api/health').json();assert health['version']=='4.3.0';assert len(request.get(base+'/api/tables').json()['tables'])==6
   assert request.post(base+'/api/register',data={'username':'SOR-VARG','password':secret}).status==403
   assert request.post(base+'/api/login',data={'username':'SOR-VARG','password':'fixture-incorrect'}).status==401
   player=request.post(base+'/api/register',data={'username':'Joueur-fictif','password':secrets.token_urlsafe(18)});assert player.status==200;assert not player.json()['user']['isAdmin']
   assert request.get(base+'/api/admin',headers={'authorization':'Bearer '+player.json()['token']}).status==403
   browser=p.chromium.launch(headless=True,executable_path=os.environ.get('SOR_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage']);cases=[]
   for width in [320,390,1366]:
    context=browser.new_context(viewport={'width':width,'height':950},is_mobile=width<800,has_touch=True,service_workers='block');page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    response=page.goto(base+'/admin.html',wait_until='networkidle');assert response.status==200;expect(page.locator('#adminLoginForm [name=username]')).to_have_value('SOR-VARG');expect(page.locator('#adminLoginForm [name=password]')).to_have_attribute('type','password')
    page.locator('#adminLoginForm [name=password]').fill(secret);page.locator('#adminLoginForm button[type=submit]').tap();expect(page.locator('#adminConsole')).to_be_visible();expect(page.locator('#adminLoginCard')).to_be_hidden();page.wait_for_load_state('networkidle');token=page.evaluate('localStorage.getItem("bw_token")');me=context.request.get(base+'/api/me',headers={'authorization':'Bearer '+token}).json()['user'];assert me['isAdmin'] and me['username']=='SOR-VARG';admin=context.request.get(base+'/api/admin',headers={'authorization':'Bearer '+token});assert admin.status==200;users=admin.json()['users'];assert len([u for u in users if u['username']=='SOR-VARG'])==1;assert next(u for u in users if u['username']=='SOR-VARG')['is_admin'];assert admin.json()['settings']=={'active_tables':6,'min_bet':10};page.screenshot(path=str(out/('ADMIN_'+str(width)+'.png')))
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+3');page.goto(base,wait_until='networkidle');expect(page.locator('#tables .table-card')).to_have_count(6);assert page.locator('.sor-reaper').evaluate('e=>e.complete&&e.naturalWidth>0');assert not errors,errors;cases.append({'width':width,'http':200,'username_prefilled':True,'admin_login':True,'single_admin_account':True,'lobby_tables':6,'result':'PASS'});context.close();print('PASS SOR-VARG interface',width,flush=True)
   browser.close();request.dispose()
 (out/'VALIDATION_ADMIN.json').write_text(json.dumps({'version':'1.2.0-sor-roulette','worker_version':'4.3.0','date':'2026-11-07','secret_tested':'fixture_random_not_user_password','password_stored_in_zip':False,'local_workerd_d1':True,'browser_cases':cases,'public_registration_reserved_name_blocked':True,'wrong_password_rejected':True,'player_admin_access_rejected':True,'physical_android_tested':False,'actual_fivem_tested':False,'production_deployed':False,'production_account_created':False,'real_club_data_changed':False},ensure_ascii=False,indent=2)+'\n');print('PASS workerd/D1 locale : initialisation SOR-VARG, connexion admin PC/mobile, un seul compte, six tables et paramètres conservés, aucun secret réel utilisé.')
finally:
 if server is not None:
  server.terminate()
  try:server.wait(timeout=10)
  except subprocess.TimeoutExpired:server.kill();server.wait()
 shutil.rmtree(tmp)
