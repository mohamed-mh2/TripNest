import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';

test(
  'real PostgreSQL help workflow: sessions, ownership, agent permissions, decisions and saved summary',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const schema = 'help_test_' + randomUUID().replaceAll('-', '');
    const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query('CREATE SCHEMA ' + schema);
    const db = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      options: '-c search_path=' + schema + ',public',
    });
    const secret = 'support-integration-test-secret-abcdefghijklmnopqrstuvwxyz';
    const user = randomUUID(),
      other = randomUUID(),
      agent = randomUUID();
    const trip = randomUUID(),
      otherTrip = randomUUID();
    const sessions = [randomUUID(), randomUUID(), randomUUID()];
    const identities = [user, other, agent];
    try {
      for (const file of [
        'development.sql',
        'bookings.sql',
        'support.sql',
        'support.sql',
      ])
        await db.query(
          await readFile(new URL('../database/' + file, import.meta.url), 'utf8'),
        );
      await db.query(
        "INSERT INTO users(id,name) VALUES($1,'Traveler'),($2,'Other'),($3,'Agent')",
        [user, other, agent],
      );
      await db.query(
        "INSERT INTO trips(id,owner_id,title,destination_city,start_date,end_date,budget_minor,currency) VALUES($1,$2,'Saved Barcelona trip','Barcelona','2035-05-01','2035-05-07',160000,'EUR'),($3,$4,'Private trip','Rome','2035-06-01','2035-06-07',100000,'EUR')",
        [trip, user, otherTrip, other],
      );
      await db.query('INSERT INTO support_agents(user_id) VALUES($1)', [agent]);
      await db.query(
        "INSERT INTO bookings(id,trip_id,total_minor,refunded_minor,reference,status,travelers) VALUES($1,$2,3900,0,'TN-HELP-TEST','confirmed',2)",
        [randomUUID(), trip],
      );
      const tokens = [];
      for (let i = 0; i < identities.length; i++) {
        await db.query(
          "INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
          [sessions[i], identities[i]],
        );
        tokens.push(
          jwt.sign({ sid: sessions[i] }, secret, {
            subject: identities[i],
            expiresIn: '1h',
            issuer: 'tripnest',
            audience: 'tripnest-web',
          }),
        );
      }
      const app = createApp(db, { secret });
      const call = (who, method, path, body) => {
        const req = request(app)
          [method]('/api/help' + path)
          .set('Authorization', 'Bearer ' + tokens[who]);
        return body ? req.send(body) : req;
      };
      assert.equal((await request(app).get('/api/help/tickets')).status, 401);
      assert.equal(
        (
          await request(app)
            .get('/api/dev/support-session')
            .set('Authorization', 'Bearer ' + tokens[0])
        ).status,
        404,
      );
      assert.equal(
        (await call(0, 'get', '/admin/tickets').set('x-role', 'admin')).status,
        403,
      );
      assert.equal((await call(0, 'get', '/readiness/' + otherTrip)).status, 404);
      assert.equal(
        (
          await call(0, 'patch', '/readiness/' + otherTrip, {
            itemKey: 'esim',
            completed: true,
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await call(0, 'post', '/tickets', {
            tripId: otherTrip,
            category: 'booking',
            message: 'Someone else trip issue',
          })
        ).status,
        404,
      );
      assert.equal((await call(0, 'get', '/trips/' + otherTrip + '/export')).status, 404);
      let response = await call(0, 'get', '/readiness/' + trip);
      assert.equal(response.status, 200);
      assert.equal(response.body.data.items.length, 6);
      response = await call(0, 'patch', '/readiness/' + trip, {
        itemKey: 'esim',
        completed: true,
      });
      assert.equal(response.body.data.progress.percentage, 17);
      assert.equal(
        (await call(0, 'get', '/readiness/' + trip)).body.data.items.find(
          (item) => item.key === 'esim',
        ).completed,
        true,
      );
      assert.equal(
        (
          await call(0, 'patch', '/readiness/' + trip, {
            itemKey: 'fake',
            completed: true,
          })
        ).status,
        400,
      );
      await db.query("UPDATE trips SET status='archived' WHERE id=$1", [trip]);
      assert.equal(
        (
          await call(0, 'patch', '/readiness/' + trip, {
            itemKey: 'esim',
            completed: false,
          })
        ).status,
        409,
      );
      assert.equal((await call(0, 'get', '/readiness/' + trip)).status, 200);
      await db.query("UPDATE trips SET status='active' WHERE id=$1", [trip]);
      response = await call(0, 'post', '/tickets', {
        tripId: trip,
        category: 'transport',
        message: 'My airport transfer time needs checking.',
      });
      assert.equal(response.status, 201);
      const ticket = response.body.data.ticket.id;
      assert.equal((await call(1, 'get', '/tickets/' + ticket)).status, 404);
      assert.equal(
        (await call(1, 'get', '/tickets/' + ticket + '/alternative')).status,
        404,
      );
      assert.equal((await call(1, 'get', '/tickets')).body.data.tickets.length, 0);
      assert.equal(
        (await call(2, 'get', '/admin/tickets?status=open')).body.data.tickets.length,
        1,
      );
      const proposal = {
        originalTitle: 'Airport transfer at noon',
        originalPriceMinor: 3900,
        alternativeTitle: 'Airport transfer at 14:00',
        alternativePriceMinor: 3500,
        currency: 'EUR',
      };
      assert.equal(
        (await call(2, 'post', '/admin/tickets/' + ticket + '/alternative', proposal))
          .status,
        409,
      );
      assert.equal(
        (
          await call(2, 'patch', '/admin/tickets/' + ticket, {
            status: 'resolved',
            resolutionNote: 'Checked the transfer booking.',
          })
        ).status,
        409,
      );
      assert.equal(
        (await call(2, 'patch', '/admin/tickets/' + ticket, { status: 'in_progress' }))
          .status,
        200,
      );
      assert.equal(
        (await call(2, 'patch', '/admin/tickets/' + ticket, { status: 'resolved' }))
          .status,
        400,
      );
      // Parallel proposals serialize on the ticket, producing exactly one pending offer.
      const concurrent = await Promise.all([
        call(2, 'post', '/admin/tickets/' + ticket + '/alternative', proposal),
        call(2, 'post', '/admin/tickets/' + ticket + '/alternative', proposal),
      ]);
      assert.deepEqual(concurrent.map((result) => result.status).sort(), [201, 409]);
      assert.equal(
        (
          await call(1, 'patch', '/tickets/' + ticket + '/alternative', {
            decision: 'accepted',
          })
        ).status,
        404,
      );
      const before = (await db.query('SELECT * FROM bookings')).rows;
      response = await call(0, 'patch', '/tickets/' + ticket + '/alternative', {
        decision: 'accepted',
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.data.bookingMutated, false);
      assert.equal(response.body.data.replacementExecutionRequired, true);
      assert.equal(
        (
          await call(0, 'patch', '/tickets/' + ticket + '/alternative', {
            decision: 'rejected',
          })
        ).status,
        409,
      );
      assert.deepEqual((await db.query('SELECT * FROM bookings')).rows, before);
      assert.equal(
        (await call(0, 'get', '/tickets/' + ticket)).body.data.ticket.status,
        'in_progress',
      );
      assert.equal(
        (
          await call(2, 'patch', '/admin/tickets/' + ticket, {
            status: 'resolved',
            resolutionNote: 'The alternative is ready; review your approval.',
          })
        ).status,
        200,
      );
      assert.equal(
        (await call(2, 'patch', '/admin/tickets/' + ticket, { status: 'closed' })).status,
        200,
      );
      assert.equal(
        (await call(2, 'patch', '/admin/tickets/' + ticket, { status: 'open' })).status,
        409,
      );
      assert.equal(
        (await call(2, 'post', '/admin/tickets/' + ticket + '/alternative', proposal))
          .status,
        409,
      );
      const audits = (await db.query('SELECT action,metadata FROM audit_events')).rows;
      assert.ok(audits.some((row) => row.action === 'support_alternative_accepted'));
      assert.ok(
        audits.every((row) => !JSON.stringify(row.metadata).includes('resolutionNote')),
      );
      response = await call(0, 'get', '/trips/' + trip + '/export');
      assert.equal(response.status, 200);
      assert.equal(response.headers['x-tripnest-overview'], 'saved-trip');
      assert.match(response.text, /Saved Barcelona trip/);
      assert.match(response.text, /Barcelona/);
      assert.match(response.text, /TN-HELP-TEST/);
      assert.doesNotMatch(response.text, /TN-DEMO-FLIGHT|Lisbon long weekend/);
      await db.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [sessions[0]]);
      assert.equal((await call(0, 'get', '/tickets')).status, 401);
    } finally {
      await db.end();
      await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
      await admin.end();
    }
  },
);
