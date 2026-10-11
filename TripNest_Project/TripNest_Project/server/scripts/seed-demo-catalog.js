import { createDatabase } from '../src/db.js';
import { seedDemoCatalog } from '../src/models/demoCatalog.js';

if (process.env.NODE_ENV !== 'development' || process.env.DEMO_MODE !== 'true')
  throw new Error('Catalog examples are enabled only in development demo mode.');
const db = createDatabase(process.env.DATABASE_URL);
try {
  console.log('Demo catalog:', await seedDemoCatalog(db));
} finally {
  await db.end();
}
