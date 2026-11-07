"""Parcours publics de connexion/inscription sur workerd et D1 locale, erreurs visibles et reprises."""
from pathlib import Path
import json,os,secrets,shutil,socket,subprocess,tempfile,time
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'livraison/1.0.2-sor-connexion';out.mkdir(parents=True,exist_ok=True)
tmp=Path(tempfile.mkdtemp(prefix='sor-auth-local-'));server=None;admin_secret=secrets.token_urlsafe(24);cases=[]
try:
 sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base='http://127.0.0.1:'+str(port)
 with (tmp/'workerd.log').open('w') as log:
  server=subprocess.Popen([os.environ.get('SOR_WRANGLER_BIN','wrangler'),'pages','dev',str(root/'deploy'),'--d1','DB','--binding','ADMIN_BOOTSTRAP_PASSWORD='+admin_secret,'--ip','127.0.0.1','--port',str(port),'--inspector-port','0','--persist-to',str(tmp/'state'),'--compatibility-date','2026-10-28','--show-interactive-dev-session','false'],cwd=tmp,env={**os.environ,'WRANGLER_SEND_METRICS':'false','XDG_CONFIG_HOME':str(tmp/'config')},stdout=log,stderr=log)
  with sync_playwright() as p:
   request=p.request.new_context();ready=False
   for _ in range(150):
    if server.poll() is not None:raise RuntimeError('Serveur local arrêté : '+(tmp/'workerd.log').read_text()[-1800:])
    try:
     if request.get(base+'/api/health',timeout=1000).status==200:ready=True;break
    except Exception:pass
    time.sleep(.2)
   assert ready,'Serveur local non prêt';admin=request.post(base+'/api/login',data={'username':'SOR-VARG','password':admin_secret});assert admin.status==200;admin_headers={'authorization':'Bearer '+admin.json()['token']}
   def users():return request.get(base+'/api/admin',headers=admin_headers).json()['users']
   browser=p.chromium.launch(headless=True,executable_path=os.environ.get('SOR_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
   for width in json.loads(os.environ.get('SOR_AUTH_WIDTHS','[320,390,1366]')):
    c=browser.new_context(viewport={'width':width,'height':740 if width<800 else 950},has_touch=True,is_mobile=width<800,service_workers='block');page=c.new_page();page.set_default_timeout(20000);errors=[];mutations=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:mutations.append(r.url) if r.method=='POST' and r.url.rsplit('/',1)[-1] in ['login','register'] else None);page.goto(base,wait_until='networkidle');expect(page.locator('#tables .table-card')).to_have_count(6)
    def menu(action):page.locator('#menuToggle').tap();page.locator('#siteMenu [data-menu-action='+action+']').tap()
    def fill(name,password):page.locator('#authForm [name=username]').fill(name);page.locator('#authForm [name=password]').fill(password)
    def submit(endpoint,status):
     with page.expect_response(lambda r:r.url.endswith('/api/'+endpoint) and r.request.method=='POST') as response:page.locator('#authSubmit').tap()
     assert response.value.status==status,response.value.text();return response.value
    def close_form():page.locator('#authDialog .close').tap();expect(page.locator('#authDialog')).not_to_be_visible()
    def visible_error(text=None):
     field=page.locator('#authDialog [role=alert]');expect(field).to_be_visible();assert page.locator('#authDialog').evaluate('e=>e.contains(document.querySelector("#authError"))')
     if text:expect(field).to_contain_text(text)
     expect(page.locator('#authSubmit')).to_be_enabled();expect(page.locator('#authForm')).to_have_attribute('aria-busy','false')
    name='Fictif-'+str(width);password=secrets.token_urlsafe(18)
    menu('register');fill(name,'court');before=len(mutations);page.locator('#authSubmit').tap();assert len(mutations)==before;assert page.locator('#authForm [name=password]').evaluate('e=>!e.checkValidity()');expect(page.locator('#authError')).to_be_visible()
    # Fermer un formulaire rempli ne doit jamais lancer d'inscription.
    fill(name,password);close_form();assert len(mutations)==before;assert not any(u['username']==name for u in users())
    menu('register');fill(name,password)
    with page.expect_response(lambda r:r.url.endswith('/api/register') and r.request.method=='POST') as response:page.locator('#authForm [name=password]').press('Enter')
    assert response.value.status==200;expect(page.locator('#authDialog')).not_to_be_visible();expect(page.locator('#siteMenu .menu-account strong')).to_have_text(name);token=page.evaluate('localStorage.getItem("bw_token")');me=c.request.get(base+'/api/me',headers={'authorization':'Bearer '+token}).json()['user'];assert me['username']==name and me['chips']==0 and not me['isAdmin'];menu('logout')
    # Une erreur serveur réelle doit rester visible dans la fenêtre active.
    menu('register');fill(name,password);r=submit('register',409);visible_error(r.json()['error']);page.locator('#authError').scroll_into_view_if_needed();page.screenshot(path=str(out/('COMPTE_EXISTANT_'+str(width)+'.png')))
    if width==1366:page.locator('#authSwitch').focus();page.keyboard.press('Enter')
    else:page.locator('#authSwitch').tap()
    expect(page.locator('#authTitle')).to_have_text('Connexion');expect(page.locator('#authError')).to_be_hidden();fill(name,'fixture-incorrect');r=submit('login',401);visible_error(r.json()['error']);page.locator('#authError').scroll_into_view_if_needed();page.screenshot(path=str(out/('ERREUR_CONNEXION_'+str(width)+'.png')))
    page.locator('#authForm [name=password]').fill(password);expect(page.locator('#authError')).to_be_hidden();submit('login',200);expect(page.locator('#authDialog')).not_to_be_visible();page.reload();expect(page.locator('#siteMenu .menu-account strong')).to_have_text(name);menu('logout')
    # Compte administrateur réservé, avec une indication vers le bon mode.
    menu('register');fill('SOR-VARG',admin_secret);submit('register',403);visible_error('Utilisez Connexion');close_form()
    # Simulations ciblées : backend indisponible, réponse HTML et réseau coupé.
    pattern='**/api/login'
    for kind in ['unavailable','html','network']:
     if kind=='unavailable':page.route(pattern,lambda route:route.fulfill(status=503,content_type='application/json',body=json.dumps({'error':'Service temporairement indisponible.'})))
     elif kind=='html':page.route(pattern,lambda route:route.fulfill(status=200,content_type='text/html',body='<p>Réponse statique fictive</p>'))
     else:page.route(pattern,lambda route:route.abort('internetdisconnected'))
     menu('login');fill(name,password);page.locator('#authSubmit').tap();visible_error({'unavailable':'Service temporairement indisponible','html':'service de connexion est indisponible','network':'Connexion impossible'}[kind]);close_form();page.unroute(pattern)
    # Un compte créé n'est pas présenté comme connecté si /me échoue ensuite.
    sync_name=name+'-sync';page.route('**/api/me',lambda route:route.fulfill(status=500,content_type='application/json',body=json.dumps({'error':'Synchronisation fictive indisponible.'})));menu('register');fill(sync_name,password);submit('register',200);visible_error('Le compte a été créé');assert any(u['username']==sync_name for u in users());assert page.evaluate('localStorage.getItem("bw_token")') is None;page.unroute('**/api/me');page.locator('#authSwitch').tap();submit('login',200);expect(page.locator('#authDialog')).not_to_be_visible();menu('logout')
    timeout_tested=False
    if width==1366:
     held=[];page.route(pattern,lambda route:held.append(route));menu('login');fill(name,password);count=len(mutations);page.locator('#authSubmit').tap();expect(page.locator('#authSubmit')).to_be_disabled();expect(page.locator('#authSubmit')).to_contain_text('en cours');expect(page.locator('#authSwitch')).to_be_disabled();expect(page.locator('#authDialog .close')).to_be_disabled();page.keyboard.press('Escape');expect(page.locator('#authDialog')).to_be_visible();page.evaluate('document.querySelector("#authForm").requestSubmit()');expect(page.locator('#authError')).to_contain_text('pris trop de temps',timeout=20000);visible_error();assert len(mutations)==count+1
     for route in held:
      try:route.abort('timedout')
      except Exception:pass
     page.unroute(pattern);submit('login',200);expect(page.locator('#authDialog')).not_to_be_visible();menu('logout');timeout_tested=True
    menu('login');fill(name,password);submit('login',200);expect(page.locator('#authDialog')).not_to_be_visible();expect(page.locator('#siteMenu .menu-account strong')).to_have_text(name);expect(page.locator('#tables .table-card')).to_have_count(6);page.locator('#refreshBtn').tap();expect(page.locator('#tables .table-card')).to_have_count(6)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+3');assert not errors,errors;cases.append({'width':width,'result':'PASS','registration_and_login_real_d1':True,'errors_inside_dialog':True,'duplicate_registration_rejected':True,'cancel_without_registration':True,'server_html_network_errors_simulated':True,'me_failure_after_registration_simulated':True,'timeout_and_double_submit_tested':timeout_tested});print('PASS connexion/inscription',width,flush=True);c.close()
   browser.close();request.dispose()
 (out/'VALIDATION_CONNEXION.json').write_text(json.dumps({'version':'1.0.2-sor-connexion','base':'1.0.1-sor-admin','cases':cases,'local_workerd_d1':True,'physical_android_tested':False,'actual_fivem_tested':False,'production_tested':False,'deployed':False,'real_club_data_changed':False},ensure_ascii=False,indent=2)+'\n');print('PASS formulaires : inscription, connexion, reprise après refus, annulation, erreurs réseau/API et synchronisation, délai limité et absence de doubles envois.')
finally:
 if server is not None:
  server.terminate()
  try:server.wait(timeout=10)
  except subprocess.TimeoutExpired:server.kill();server.wait()
 shutil.rmtree(tmp)
