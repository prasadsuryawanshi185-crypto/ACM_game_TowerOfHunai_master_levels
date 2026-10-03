const { MongoClient } = require('mongodb');

async function run() {
  console.log("Testing with auth options (bypassing URI parser)...");
  const client = new MongoClient("mongodb+srv://cluster0.xqbo7y8.mongodb.net/?appName=Cluster0", { 
    auth: { username: "dsa_launchpad", password: "Pras@d2701" },
    serverSelectionTimeoutMS: 5000 
  });
  
  try {
    await client.connect();
    console.log("✅ SUCCESS!");
  } catch (err) {
    console.error("❌ FAILED:");
    console.error(err.message);
  } finally {
    await client.close();
  }
}

run();
