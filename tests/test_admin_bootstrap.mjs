import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import worker from '../app/_worker.js';

function fixture(options = {}) {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  const DB = {
    prepare(query) {
      return {
        query, args: [],
        bind(...args) { this.args = args; return this; },
        async first() { return sql.prepare(this.query).get(...this.args) || null; },
        async all() { return { results: sql.prepare(this.query).all(...this.args) }; },
        async run() {
          const result = sql.prepare(this.query).run(...this.args);
          return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
        },
      };
    },
    async batch(steps) {
      sql.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const step of steps) results.push(await step.run());
        sql.exec('COMMIT');
        return results;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  const env = { DB, ...options };
  async function request(path, method = 'GET', body, token) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    const response = await worker.fetch(new Request('https://fixture.test/api/' + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: response.status, data: await response.json() };
  }
  return { sql, env, request, close: () => sql.close() };
}

const password = () => crypto.randomBytes(20).toString('hex');
const expect = (response, status) => { assert.equal(response.status, status, JSON.stringify(response.data)); return response.data; };

{
  const f = fixture();
  try {
    const secret = password();
    expect(await f.request('login', 'POST', { username: 'SOR-VARG', password: secret }), 401);
    expect(await f.request('register', 'POST', { username: 'sor-varg', password: secret }), 403);
    expect(await f.request('register', 'POST', { username: 'manager', password: secret }), 403);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
    f.env.ADMIN_BOOTSTRAP_PASSWORD = secret;
    expect(await f.request('login', 'POST', { username: 'SOR-VARG', password: 'fixture-wrong' }), 401);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
    const login = expect(await f.request('login', 'POST', { username: 'sor-varg', password: secret }), 200);
    assert.equal(login.user.username, 'SOR-VARG');
    assert.equal(login.user.isAdmin, true);
    assert.equal(login.user.chips, 0);
    const admin = f.sql.prepare('SELECT * FROM users').get();
    assert.notEqual(admin.password_hash, secret);
    assert.ok(admin.salt && admin.password_hash);
    assert.equal(admin.is_admin, 1);
    expect(await f.request('admin', 'GET', undefined, login.token), 200);
    const again = expect(await f.request('login', 'POST', { username: 'SOR-VARG', password: secret }), 200);
    assert.equal(again.user.id, login.user.id);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
    const player = expect(await f.request('register', 'POST', { username: 'Joueur-Fictif', password: password() }), 200);
    assert.equal(player.user.isAdmin, false);
    expect(await f.request('admin', 'GET', undefined, player.token), 403);
    expect(await f.request('profile', 'POST', { username: 'SOR-VARG', avatar: '' }, player.token), 403);
    expect(await f.request('profile', 'POST', { username: 'manager', avatar: '' }, player.token), 403);
    expect(await f.request('join', 'POST', { tableId: 1 }, login.token), 403);
    const replacement = password();
    expect(await f.request('profile', 'POST', { username: 'SOR-VARG', avatar: '', currentPassword: secret, newPassword: replacement }, login.token), 200);
    expect(await f.request('login', 'POST', { username: 'SOR-VARG', password: secret }), 401);
    expect(await f.request('login', 'POST', { username: 'SOR-VARG', password: replacement }), 200);
    delete f.env.ADMIN_BOOTSTRAP_PASSWORD;
    expect(await f.request('login', 'POST', { username: 'SOR-VARG', password: replacement }), 200);
    assert.equal(expect(await f.request('tables'), 200).tables.length, 6);
    assert.deepEqual(f.sql.prepare('PRAGMA foreign_key_check').all(), []);
    console.log('PASS SOR-VARG : secret requis, nom réservé, compte unique haché, accès admin, joueur refusé, changement de mot de passe conservé, tables et relations intactes.');
  } finally { f.close(); }
}

{
  const secret = password(), f = fixture({ ADMIN_BOOTSTRAP_PASSWORD: secret });
  try {
    expect(await f.request('tables'), 200);
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256').toString('hex');
    f.sql.prepare('INSERT INTO users(username,password_hash,salt,chips,is_admin) VALUES(?,?,?,?,0)').run('SOR-VARG', hash, salt, 123);
    const before = f.sql.prepare('SELECT * FROM users').get();
    expect(await f.request('login', 'POST', { username: 'SOR-VARG', password: secret }), 409);
    assert.deepEqual(f.sql.prepare('SELECT * FROM users').get(), before);
    console.log('PASS collision : aucun compte joueur promu, écrasé ou vidé automatiquement.');
  } finally { f.close(); }
}

for (const username of ['manager', 'ADMIN-FICTIF']) {
  const secret = password(), f = fixture({ ADMIN_BOOTSTRAP_PASSWORD: secret, ADMIN_BOOTSTRAP_USERNAME: username });
  try {
    expect(await f.request('register', 'POST', { username, password: secret }), 403);
    const login = expect(await f.request('login', 'POST', { username, password: secret }), 200);
    assert.equal(login.user.username, username);
    assert.equal(login.user.isAdmin, true);
    delete f.env.ADMIN_BOOTSTRAP_USERNAME;
    delete f.env.ADMIN_BOOTSTRAP_PASSWORD;
    expect(await f.request('login', 'POST', { username, password: secret }), 200);
  } finally { f.close(); }
}
console.log('PASS compatibilité : comptes manager existants et nom configurable conservés.');
