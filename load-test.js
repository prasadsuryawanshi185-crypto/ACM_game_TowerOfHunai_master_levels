// ============================================================
// Load Test: Simulates ~200 concurrent participants
// Run with: node load-test.js
//
// Prerequisites: Server must be running with MongoDB connected.
// ============================================================

const http = require('http');

const SERVER = { hostname: 'localhost', port: 4000 };
const NUM_PARTICIPANTS = 200;
const DISK_OPTIONS = [3, 4, 5];

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const options = {
      ...SERVER,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const elapsed = Date.now() - start;
        resolve({ status: res.statusCode, elapsed, data: data });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(new Error('Timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function simulateParticipant(id) {
  const name = `Participant_${String(id).padStart(3, '0')}`;
  const diskCount = DISK_OPTIONS[randomBetween(0, 2)];
  const minMoves = Math.pow(2, diskCount) - 1;
  const moves = minMoves + randomBetween(0, minMoves); // Between optimal and 2x optimal
  const timeTaken = randomBetween(20, 280); // 20s to ~4.5 min

  try {
    // Submit result
    const submitResult = await makeRequest('POST', '/api/submit', {
      participantName: name,
      participantId: `ACM-${String(id).padStart(3, '0')}`,
      diskCount,
      moves,
      timeTaken,
    });

    // Fetch leaderboard
    const lbResult = await makeRequest('GET', '/api/leaderboard');

    return {
      id,
      name,
      submitStatus: submitResult.status,
      submitTime: submitResult.elapsed,
      lbStatus: lbResult.status,
      lbTime: lbResult.elapsed,
      success: submitResult.status === 201,
    };
  } catch (err) {
    return {
      id,
      name,
      error: err.message,
      success: false,
    };
  }
}

async function runLoadTest() {
  console.log(`\n========================================`);
  console.log(`  LOAD TEST: ${NUM_PARTICIPANTS} Concurrent Participants`);
  console.log(`========================================\n`);

  // Check server is running
  try {
    const health = await makeRequest('GET', '/api/health');
    const healthData = JSON.parse(health.data);
    console.log(`Server status: ${healthData.status}`);
    console.log(`Database:      ${healthData.database}`);
    if (healthData.database !== 'connected') {
      console.error('\n⚠ Database not connected. Load test requires MongoDB.');
      console.error('Please start MongoDB and restart the server.\n');
      process.exit(1);
    }
  } catch (err) {
    console.error(`Server not reachable: ${err.message}`);
    process.exit(1);
  }

  console.log(`\nLaunching ${NUM_PARTICIPANTS} concurrent submissions...\n`);
  const startTime = Date.now();

  // Fire all requests concurrently
  const promises = [];
  for (let i = 1; i <= NUM_PARTICIPANTS; i++) {
    promises.push(simulateParticipant(i));
  }

  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;

  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const errors = results.filter(r => r.error);

  const submitTimes = results.filter(r => r.submitTime).map(r => r.submitTime);
  const lbTimes = results.filter(r => r.lbTime).map(r => r.lbTime);

  const avgSubmit = submitTimes.reduce((a, b) => a + b, 0) / submitTimes.length;
  const maxSubmit = Math.max(...submitTimes);
  const minSubmit = Math.min(...submitTimes);

  const avgLb = lbTimes.reduce((a, b) => a + b, 0) / lbTimes.length;
  const maxLb = Math.max(...lbTimes);

  console.log(`========== RESULTS ==========`);
  console.log(`Total time:         ${totalTime}ms`);
  console.log(`Successful:         ${successful.length}/${NUM_PARTICIPANTS}`);
  console.log(`Failed:             ${failed.length}`);
  console.log(`Network errors:     ${errors.length}`);
  console.log(`\nSubmit Response Times:`);
  console.log(`  Average: ${Math.round(avgSubmit)}ms`);
  console.log(`  Min:     ${minSubmit}ms`);
  console.log(`  Max:     ${maxSubmit}ms`);
  console.log(`\nLeaderboard Response Times:`);
  console.log(`  Average: ${Math.round(avgLb)}ms`);
  console.log(`  Max:     ${maxLb}ms`);

  if (failed.length > 0) {
    console.log(`\n--- Failed Submissions ---`);
    const statusCounts = {};
    failed.forEach(r => {
      const key = r.error || r.submitStatus;
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    });
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  Status ${status}: ${count}`);
    });
  }

  // Verify leaderboard
  console.log(`\n--- Verifying Leaderboard ---`);
  const lbCheck = await makeRequest('GET', '/api/leaderboard');
  const lbData = JSON.parse(lbCheck.data);
  console.log(`Leaderboard entries: ${lbData.leaderboard.length}`);
  if (lbData.leaderboard.length > 0) {
    console.log(`Top 5:`);
    lbData.leaderboard.slice(0, 5).forEach(entry => {
      console.log(`  #${entry.rank} ${entry.participantName} — Score: ${entry.score}, Moves: ${entry.moves}, Time: ${entry.timeTaken}s`);
    });
  }

  console.log(`\n========== LOAD TEST COMPLETE ==========\n`);

  // Pass/Fail criteria
  const passRate = successful.length / NUM_PARTICIPANTS;
  if (passRate >= 0.95 && avgSubmit < 5000) {
    console.log('✅ PASSED — System can handle 200 concurrent participants');
  } else if (passRate >= 0.8) {
    console.log('⚠ PARTIAL — Some requests failed but majority succeeded');
  } else {
    console.log('❌ FAILED — Too many failures under load');
  }
}

runLoadTest().catch(console.error);
