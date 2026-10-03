const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://dsa_launchpad:Prasad123@cluster0.xqbo7y8.mongodb.net/?appName=Cluster0";
  console.log("Testing connection with Prasad123...");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  
  try {
    await client.connect();
    console.log("✅ SUCCESS! The password Prasad123 works.");
    const db = client.db('admin');
    const result = await db.command({ ping: 1 });
    console.log("Ping result:", result);
  } catch (err) {
    console.error("❌ FAILED:");
    console.error(err.message);
  } finally {
    await client.close();
  }
}

run();
