import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTokenHash } from '../src/models/accountSetup.js';

test(
  'account activation and profile permissions on real PostgreSQL',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    // All users, invitations and passwords in this test live in a disposable schema.
    const schema = 'activation_test_' + randomUUID().replaceAll('-', '');
    const owner = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await owner.query('CREATE SCHEMA ' + schema);
    const db = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      options: '-c search_path=' + schema + ',public',
    });
    try {
      for (const file of [
        'development.sql',
        'bookings.sql',
        'support.sql',
        'accounts.sql',
      ])
        await db.query(
          await readFile(new URL('../database/' + file, import.meta.url), 'utf8'),
        );
      const app = createApp(db, {
        secret: 'activation-integration-test-secret-abcdefghijklmnopqrstuvwxyz',
      });
      const token = randomBytes(32).toString('hex');
      const id = randomUUID();
      await db.query(
        "INSERT INTO users(id,name,email,role) VALUES($1,'Invited owner','owner@example.test','admin')",
        [id],
      );
      await db.query(
        "INSERT INTO account_setup_invitations(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",
        [id, setupTokenHash(token)],
      );
      let activated;

      await t.test(
        'preview exposes no credential; invalid passwords do not consume the invitation',
        async () => {
          await request(app)
            .post('/api/auth/setup/preview')
            .send({ token: 'invalid' })
            .expect(400);
          const preview = (
            await request(app).post('/api/auth/setup/preview').send({ token }).expect(200)
          ).body;
          assert.equal(preview.invitation.email, 'owner@example.test');
          assert.deepEqual(Object.keys(preview.invitation).sort(), [
            'email',
            'expires_at',
            'name',
          ]);
          assert.equal(JSON.stringify(preview).includes(token), false);
          await request(app)
            .post('/api/auth/setup/activate')
            .send({ token, password: 'short' })
            .expect(400);
          assert.equal(
            (
              await db.query(
                'SELECT used_at FROM account_setup_invitations WHERE user_id=$1',
                [id],
              )
            ).rows[0].used_at,
            null,
          );
          assert.notEqual(
            (
              await db.query(
                'SELECT token_hash FROM account_setup_invitations WHERE user_id=$1',
                [id],
              )
            ).rows[0].token_hash,
            token,
          );
        },
      );

      await t.test(
        'simultaneous activation succeeds once and keeps the server-selected role',
        async () => {
          const passwords = ['fixture-first-password', 'fixture-second-password'];
          const responses = await Promise.all(
            passwords.map((password) =>
              request(app)
                .post('/api/auth/setup/activate')
                .send({
                  token,
                  password,
                  role: 'customer',
                  email: 'someone@example.test',
                }),
            ),
          );
          assert.deepEqual(responses.map((r) => r.status).sort(), [200, 410]);
          const winner = responses.findIndex((r) => r.status === 200);
          activated = responses[winner].body;
          assert.equal(activated.user.role, 'admin');
          assert.equal(activated.user.email, 'owner@example.test');
          assert.equal('password_hash' in activated.user, false);
          const hash = (
            await db.query('SELECT password_hash FROM users WHERE id=$1', [id])
          ).rows[0].password_hash;
          assert.equal(await bcrypt.compare(passwords[winner], hash), true);
          assert.equal(await bcrypt.compare(passwords[1 - winner], hash), false);
          assert.equal(
            (
              await db.query(
                'SELECT count(*)::int AS total FROM sessions WHERE user_id=$1',
                [id],
              )
            ).rows[0].total,
            1,
          );
          await request(app).post('/api/auth/setup/preview').send({ token }).expect(410);
          await request(app)
            .post('/api/auth/setup/activate')
            .send({ token, password: 'third-password' })
            .expect(410);
          await request(app)
            .get('/api/help/admin/tickets')
            .set('Authorization', 'Bearer ' + activated.token)
            .expect(200);
        },
      );

      await t.test(
        'profile updates affect only the signed-in user and cannot elevate roles',
        async () => {
          const customer = (
            await request(app)
              .post('/api/auth/register')
              .send({
                name: 'Customer',
                email: 'customer@example.test',
                password: 'fixture-customer-password',
                role: 'admin',
              })
              .expect(201)
          ).body;
          assert.equal(customer.user.role, 'customer');
          await request(app)
            .patch('/api/auth/profile')
            .send({ name: 'Unauthorized' })
            .expect(401);
          const patch = (body) =>
            request(app)
              .patch('/api/auth/profile')
              .set('Authorization', 'Bearer ' + customer.token)
              .send(body);
          await patch({ name: 'Customer', role: 'admin' }).expect(400);
          await patch({ name: 'Customer', id }).expect(400);
          await patch({ name: 'A' }).expect(400);
          const saved = (await patch({ name: '  Updated customer  ' }).expect(200)).body;
          assert.equal(saved.user.name, 'Updated customer');
          assert.equal(saved.user.role, 'customer');
          assert.equal(
            (await db.query('SELECT name FROM users WHERE id=$1', [id])).rows[0].name,
            'Invited owner',
          );
          await request(app)
            .get('/api/help/admin/tickets')
            .set('Authorization', 'Bearer ' + customer.token)
            .set('x-role', 'admin')
            .expect(403);
          await request(app)
            .post('/api/auth/logout')
            .set('Authorization', 'Bearer ' + customer.token)
            .expect(204);
          await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer ' + customer.token)
            .expect(401);
          const login = (
            await request(app)
              .post('/api/auth/login')
              .send({
                email: 'customer@example.test',
                password: 'fixture-customer-password',
              })
              .expect(200)
          ).body;
          assert.equal(login.user.name, 'Updated customer');
        },
      );

      await t.test(
        'expired invitations and accounts with an existing password cannot activate',
        async () => {
          const expiredId = randomUUID(),
            expiredToken = randomBytes(32).toString('hex');
          await db.query(
            "INSERT INTO users(id,name,email) VALUES($1,'Expired owner','expired@example.test')",
            [expiredId],
          );
          await db.query(
            "INSERT INTO account_setup_invitations(user_id,token_hash,expires_at) VALUES($1,$2,now()-interval '1 minute')",
            [expiredId, setupTokenHash(expiredToken)],
          );
          await request(app)
            .post('/api/auth/setup/activate')
            .send({ token: expiredToken, password: 'fixture-valid-password' })
            .expect(410);
          const anotherToken = randomBytes(32).toString('hex');
          const originalHash = (
            await db.query('SELECT password_hash FROM users WHERE id=$1', [id])
          ).rows[0].password_hash;
          await db.query(
            "UPDATE account_setup_invitations SET token_hash=$2,used_at=NULL,expires_at=now()+interval '1 hour' WHERE user_id=$1",
            [id, setupTokenHash(anotherToken)],
          );
          await request(app)
            .post('/api/auth/setup/activate')
            .send({ token: anotherToken, password: 'fixture-replacement-password' })
            .expect(410);
          assert.equal(
            (await db.query('SELECT password_hash FROM users WHERE id=$1', [id])).rows[0]
              .password_hash,
            originalHash,
          );
        },
      );
    } finally {
      await db.end();
      await owner.query('DROP SCHEMA ' + schema + ' CASCADE');
      await owner.end();
    }
  },
);
