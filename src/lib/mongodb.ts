import {MongoClient} from "mongodb";
import mongoose from "mongoose";

// Lazy initialization - only check and create connection when needed
function getMongoUri(): string {
  if (!process.env.MONGODB_URI) {
    throw new Error("Please add your MONGODB_URI to .env.local");
  }
  return process.env.MONGODB_URI;
}

function getMongoOptions() {
  return {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000
  };
}

let client: MongoClient;
let clientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  if (clientPromise) {
    return clientPromise;
  }

  const uri = getMongoUri();
  const options = getMongoOptions();

  if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable to preserve the client across hot reloads
    let globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
  } else {
    // In production mode, create a new client
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }

  return clientPromise;
}

// Export the function for direct use
export { getClientPromise };

// Default export - lazy initialization
// This maintains backward compatibility with existing code
// The promise is created lazily when first accessed
let _defaultClientPromise: Promise<MongoClient> | null = null;

function getDefaultClientPromise(): Promise<MongoClient> {
  if (!_defaultClientPromise) {
    _defaultClientPromise = getClientPromise();
  }
  return _defaultClientPromise;
}

// Create a promise-like object that delegates to the actual promise
const defaultExport = Object.assign(
  Object.create(Promise.prototype),
  {
    then: (...args: any[]) => getDefaultClientPromise().then(...args),
    catch: (...args: any[]) => getDefaultClientPromise().catch(...args),
    finally: (...args: any[]) => getDefaultClientPromise().finally(...args),
  }
) as Promise<MongoClient>;

export default defaultExport;

// Mongoose connection for models
interface Cached {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

let mongooseCache: Cached = (global as any).mongoose;

if (!mongooseCache) {
  mongooseCache = (global as any).mongoose = {conn: null, promise: null};
}

export async function dbConnect() {
  // Lazy check for MONGODB_URI
  const MONGODB_URI = getMongoUri();
  
  if (mongooseCache.conn) {
    return mongooseCache.conn;
  }

  if (!mongooseCache.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    };

    mongooseCache.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongoose) => {
        return mongoose;
      });
  }

  try {
    mongooseCache.conn = await mongooseCache.promise;
  } catch (e) {
    mongooseCache.promise = null;
    throw e;
  }

  return mongooseCache.conn;
}
