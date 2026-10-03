const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dsa_launchpad:Pras%40d2701@cluster0.xqbo7y8.mongodb.net/?appName=Cluster0";

async function run() {
  console.log("Attempting to connect to MongoDB...");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    console.log("✅ SUCCESS! Connected to MongoDB Atlas.");
    
    const db = client.db('dsa_launchpad');
    const collections = await db.listCollections().toArray();
    console.log("Collections found:", collections.map(c => c.name));
    
  } catch (err) {
    console.error("❌ FAILED TO CONNECT:");
    console.error(err.message);
  } finally {
    await client.close();
  }
}

run();
