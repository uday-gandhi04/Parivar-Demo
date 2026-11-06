import mongoose from 'mongoose';

export async function connectDb(uri) {
  if (!uri) throw new Error('MONGO_URI is required');

  // Fail closed if the public demo is accidentally pointed at any database
  // other than the dedicated database named exactly `parivar_demo`.
  if (process.env.DEMO_MODE === 'true') {
    let databaseName = '';
    try {
      const parsed = new URL(uri);
      databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] || '');
    } catch {
      throw new Error('MONGO_URI is invalid. Use a dedicated MongoDB URI ending in /parivar_demo.');
    }
    if (databaseName !== 'parivar_demo') {
      throw new Error(`Safety stop: public Parivar Demo may connect only to database "parivar_demo". URI database is "${databaseName || '(not specified)'}".`);
    }
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
