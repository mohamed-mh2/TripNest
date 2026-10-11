import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  initializeCloudDatabase,
  administratorSetupToken,
} from '../src/cloudDatabase.js';

test('hosted app serves SPA deep links and preserves asset/API boundaries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tripnest-static-'));
  try {
    await writeFile(
      join(directory, 'index.html'),
      '<!doctype html><title>TripNest hosted</title>',
    );
    await writeFile(join(directory, 'theme-init.js'), 'console.log("theme")');
    const app = createApp(
      { query: async () => ({ rows: [] }) },
      {
        secret: 'cloud-test-secret-abcdefghijklmnopqrstuvwxyz',
        staticDirectory: directory,
      },
    );
    for (const path of [
      '/',
      '/about',
      '/auth',
      '/trips/123',
      '/services',
      '/readiness',
    ]) {
      const response = await request(app).get(path).set('Accept', 'text/html');
      assert.equal(response.status, 200);
      assert.match(response.text, /TripNest hosted/);
      assert.equal(response.headers['cache-control'], 'no-cache');
    }
    assert.match(
      (await request(app).get('/theme-init.js')).headers['content-type'],
      /javascript/,
    );
    assert.equal((await request(app).get('/missing.js')).status, 404);
    assert.equal((await request(app).post('/about')).status, 404);
    assert.equal((await request(app).get('/api/health')).body.status, 'ok');
    for (const path of [
      '/api/dev/session',
      '/api/dev/family-session',
      '/api/dev/support-session',
      '/api/missing',
    ]) {
      const response = await request(app).get(path).set('Accept', 'text/html');
      assert.notEqual(response.status, 200);
      assert.ok(!response.body.token);
      assert.match(response.headers['content-type'], /json/);
    }
  } finally {
    await rm(directory, { recursive: true });
  }
});

test(
  'cloud startup initializes a private empty database and safely repeats',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const schema = 'cloud_test_' + randomUUID().replaceAll('-', '');
    const adminDb = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await adminDb.query('CREATE SCHEMA ' + schema);
    const db = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      options: '-c search_path=' + schema + ',public',
    });
    const settings = {
      adminEmail: 'owner@example.test',
      adminSetupSecret: 'private-cloud-test-secret-abcdefghijklmnopqrstuvwxyz',
    };
    try {
      const result = await initializeCloudDatabase(db, settings);
      assert.equal(result.total, 65);
      const users = (await db.query('SELECT id,email,role,password_hash FROM users'))
        .rows;
      assert.equal(users.length, 1);
      assert.equal(users[0].role, 'admin');
      assert.equal(users[0].password_hash, null);
      assert.equal(
        (await db.query('SELECT count(*)::int AS count FROM sessions')).rows[0].count,
        0,
      );
      assert.equal(
        (await db.query('SELECT count(*)::int AS count FROM trips')).rows[0].count,
        0,
      );
      const invitation = (await db.query('SELECT * FROM account_setup_invitations'))
        .rows[0];
      assert.notEqual(
        invitation.token_hash,
        administratorSetupToken(settings.adminSetupSecret),
      );
      await db.query(
        'UPDATE services SET unit_price_minor=12345 WHERE id=(SELECT min(id) FROM services)',
      );
      assert.equal((await initializeCloudDatabase(db, settings)).added, 0);
      assert.equal(
        (await db.query('SELECT unit_price_minor FROM services ORDER BY id LIMIT 1'))
          .rows[0].unit_price_minor,
        12345,
      );
      assert.equal(
        (
          await db.query('SELECT expires_at FROM account_setup_invitations')
        ).rows[0].expires_at.toISOString(),
        invitation.expires_at.toISOString(),
      );
      await db.query(
        "INSERT INTO users(id,name,email,role) VALUES($1,'Existing customer','customer@example.test','customer')",
        [randomUUID()],
      );
      await assert.rejects(
        initializeCloudDatabase(db, { ...settings, adminEmail: 'customer@example.test' }),
        /existing customer/,
      );
      assert.equal(
        (await db.query("SELECT role FROM users WHERE email='customer@example.test'"))
          .rows[0].role,
        'customer',
      );
      const app = createApp(db, {
        secret: 'cloud-test-jwt-secret-abcdefghijklmnopqrstuvwxyz',
      });
      const reserved = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Impostor',
          email: settings.adminEmail,
          password: 'StudentDemo123!',
        });
      assert.equal(reserved.status, 409);
      const activated = await request(app)
        .post('/api/auth/setup/activate')
        .send({
          token: administratorSetupToken(settings.adminSetupSecret),
          password: 'StudentDemo123!',
        });
      assert.equal(activated.status, 200);
      assert.equal(activated.body.user.role, 'admin');
      assert.equal(
        (
          await request(app)
            .get('/api/help/admin/tickets')
            .set('Authorization', 'Bearer ' + activated.body.token)
        ).status,
        200,
      );
      assert.equal(
        (
          await request(app)
            .post('/api/auth/setup/activate')
            .send({
              token: administratorSetupToken(settings.adminSetupSecret),
              password: 'StudentDemo123!',
            })
        ).status,
        410,
      );
    } finally {
      await db.end();
      await adminDb.query('DROP SCHEMA ' + schema + ' CASCADE');
      await adminDb.end();
    }
  },
);
