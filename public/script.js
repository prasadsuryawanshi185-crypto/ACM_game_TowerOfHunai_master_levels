// ============================================================
// DSA Launchpad — Tower of Hanoi (Spider-Verse Edition)
// Complete game logic, UI management, and API integration
// ============================================================

(function () {
  'use strict';

  // ==================== DOM ELEMENTS ====================
  const screens = {
    login: document.getElementById('login-screen'),
    game: document.getElementById('game-screen'),
    complete: document.getElementById('complete-screen'),
    leaderboard: document.getElementById('leaderboard-screen'),
  };

  // --- DEVELOPER SETTINGS ---
  const EVENT_PASSWORD = "wce"; // Change this to your chosen password
  const EVENT_DISK_COUNT = 3;   // Number of disks participants will play with
  // --------------------------

  const participantNameInput = document.getElementById('participant-name');
  const passwordInput = document.getElementById('game-password');
  const startGameBtn = document.getElementById('start-game-btn');
  const loginViewLbBtn = document.getElementById('login-view-lb-btn');
  const loginError = document.getElementById('login-error');

  // Game HUD
  const hudLevel = document.getElementById('hud-level');
  const hudMoves = document.getElementById('hud-moves');
  const hudOptimal = document.getElementById('hud-optimal');
  const hudTimer = document.getElementById('hud-timer');
  const hudPlayer = document.getElementById('hud-player');
  const restartBtn = document.getElementById('restart-btn');
  const viewLbBtn = document.getElementById('view-lb-btn');
  const gameMessage = document.getElementById('game-message');

  // Game Board
  const stacks = [
    document.getElementById('stack-0'),
    document.getElementById('stack-1'),
    document.getElementById('stack-2'),
  ];
  const towerEls = document.querySelectorAll('.tower');

  // Completion
  const resultScore = document.getElementById('result-score');
  const resultRank = document.getElementById('result-rank');
  const resultMoves = document.getElementById('result-moves');
  const resultOptimal = document.getElementById('result-optimal');
  const resultTime = document.getElementById('result-time');
  const resultDisks = document.getElementById('result-disks');
  const playAgainBtn = document.getElementById('play-again-btn');
  const viewLeaderboardBtn = document.getElementById('view-leaderboard-btn');
  const submitOverlay = document.getElementById('submit-overlay');
  const submitError = document.getElementById('submit-error');

  // Leaderboard
  const lbLoading = document.getElementById('lb-loading');
  const lbError = document.getElementById('lb-error');
  const lbTable = document.getElementById('lb-table');
  const lbBody = document.getElementById('lb-body');
  const lbRefreshBtn = document.getElementById('lb-refresh-btn');
  const lbPlayBtn = document.getElementById('lb-play-btn');
  const lbParticipantResult = document.getElementById('lb-participant-result');

  // Sticky Rank Card
  const stickyRankCard = document.getElementById('sticky-rank-card');
  const stickyRankValue = document.getElementById('sticky-rank-value');
  const stickyRankName = document.getElementById('sticky-rank-name');
  const stickyRankStats = document.getElementById('sticky-rank-stats');
  // ==================== GAME STATE ====================
  let state = {
    participantName: '',
    participantId: '',
    level: 1, // 1: 3 disks, 2: 4 disks, 3: 5 disks
    diskCount: 3,
    towers: [[], [], []], // Each tower is an array of disk sizes (largest first)
    moves: 0,
    minimumMoves: 53, // 7 + 15 + 31
    selectedTower: null, // Index of the tower with a selected (lifted) disk
    running: false,
    timerInterval: null,
    startTime: 0,
    elapsedSeconds: 0,
    maxTime: 600, // 10 minutes total for all levels
    submitted: false,
    lastResult: null, // Stored after submission
  };

    // ==================== SCREEN MANAGEMENT ====================
  function showScreen(name) {
    if (name !== 'leaderboard' && typeof hideLeaderboard === 'function') {
      hideLeaderboard();
    }
    Object.entries(screens).forEach(([key, el]) => {
      if (key === name) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  }

  // ==================== PARTICLES (decorative) ====================
  function createParticles() {
    const container = document.getElementById('particles-container');
    if (!container) return;
    const count = 12;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'web-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (8 + Math.random() * 12) + 's';
      p.style.animationDelay = Math.random() * 10 + 's';
      p.style.width = (2 + Math.random() * 3) + 'px';
      p.style.height = p.style.width;
      container.appendChild(p);
    }
  }

  // ==================== LOGIN ====================
  function initLogin() {
    // Prevent double play
    if (localStorage.getItem('hanoi_has_played') === 'true') {
      showLoginError('You have already played the game! Please check the leaderboard.');
      startGameBtn.disabled = true;
      startGameBtn.textContent = 'ALREADY PLAYED';
      participantNameInput.disabled = true;
      if (passwordInput) passwordInput.disabled = true;
    }

    // Restore from localStorage if available
    const savedName = localStorage.getItem('hanoi_participant_name');
    if (savedName) participantNameInput.value = savedName;

    // Start game
    startGameBtn.addEventListener('click', handleStartGame);

    // Enter key
    participantNameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleStartGame();
    });
    if (passwordInput) {
      passwordInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleStartGame();
      });
    }
  }

  function handleStartGame() {
    const name = (participantNameInput.value || '').trim();
    if (!name) {
      showLoginError('Please enter your name');
      participantNameInput.focus();
      return;
    }
    if (name.length < 2) {
      showLoginError('Name must be at least 2 characters');
      participantNameInput.focus();
      return;
    }

    const pass = passwordInput ? passwordInput.value.trim() : '';
    if (pass !== EVENT_PASSWORD) {
      showLoginError('Incorrect Event Password!');
      if (passwordInput) passwordInput.focus();
      return;
    }

    showLoginError('');
    startGameBtn.disabled = true; // Prevent double-click
    state.participantName = name;
    state.participantId = '';
    state.diskCount = EVENT_DISK_COUNT;

    // Save to localStorage
    localStorage.setItem('hanoi_participant_name', state.participantName);

    startGame();

    // Re-enable after a short delay (in case they return to login)
    setTimeout(() => { startGameBtn.disabled = false; }, 1000);
  }

  function showLoginError(msg) {
    loginError.textContent = msg;
  }

  // ==================== GAME INITIALIZATION ====================
  function startGame() {
    state.level = 1;
    state.diskCount = 3;
    state.moves = 0;
    state.minimumMoves = 53; // 7 + 15 + 31
    state.selectedTower = null;
    state.running = true;
    state.animating = false;
    state.submitted = false;
    state.lastResult = null;
    state.elapsedSeconds = 0;
    state.startTime = Date.now();

    // Initialize towers: all disks on tower 0
    // Disk sizes: 1 (smallest) to diskCount (largest)
    // Tower array stores from bottom (index 0 = largest) to top
    state.towers = [[], [], []];
    for (let i = state.diskCount; i >= 1; i--) {
      state.towers[0].push(i);
    }

    showScreen('game');
    hudPlayer.textContent = state.participantName;
    renderBoard();
    updateHUD();
    startTimer();
    showGameMessage('Click a tower to select the top disk, then click another tower to move it.', 'info');
  }

  // ==================== TIMER ====================
  function startTimer() {
    stopTimer();
    state.timerInterval = setInterval(() => {
      if (!state.running) return;

      state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
      const remaining = state.maxTime - state.elapsedSeconds;

      if (remaining <= 0) {
        state.elapsedSeconds = state.maxTime;
        state.running = false;
        stopTimer();
        showGameMessage('⏰ Time is up! Click Restart to try again.', 'error');
      }

      updateHUD();
    }, 250); // Update 4x per second for smoother countdown
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, totalSeconds);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  // ==================== HUD ====================
  function updateHUD() {
    hudLevel.textContent = `${state.level} / 3`;
    hudMoves.textContent = state.moves;
    hudOptimal.textContent = state.minimumMoves;

    const remaining = state.maxTime - state.elapsedSeconds;
    hudTimer.textContent = formatTime(remaining);

    // Timer color warnings
    hudTimer.classList.remove('timer-warning', 'timer-danger');
    if (remaining <= 60) {
      hudTimer.classList.add('timer-danger');
    } else if (remaining <= 120) {
      hudTimer.classList.add('timer-warning');
    }
  }

  // ==================== GAME MESSAGES ====================
  function showGameMessage(msg, type = 'info') {
    gameMessage.textContent = msg;
    gameMessage.className = 'game-message ' + type;
  }

  // ==================== BOARD RENDERING ====================
  function renderBoard() {
    for (let i = 0; i < 3; i++) {
      const stackEl = stacks[i];
      stackEl.innerHTML = '';

      state.towers[i].forEach((diskSize, index) => {
        const diskEl = document.createElement('div');
        diskEl.className = `disk disk-${diskSize}`;
        diskEl.textContent = diskSize;
        diskEl.dataset.size = diskSize;

        // Only the top disk is interactive
        const isTop = index === state.towers[i].length - 1;
        if (!isTop) {
          diskEl.classList.add('not-top');
        }

        // If this tower is selected and this is the top disk, mark as lifting
        if (state.selectedTower === i && isTop) {
          diskEl.classList.add('lifting');
        }

        stackEl.appendChild(diskEl);
      });

      // Tower highlighting
      const towerEl = towerEls[i];
      towerEl.classList.remove('selected', 'valid-target', 'invalid-target');

      if (state.selectedTower !== null) {
        if (state.selectedTower === i) {
          towerEl.classList.add('selected');
        } else {
          // Check if this would be a valid target
          const movingDisk = state.towers[state.selectedTower][state.towers[state.selectedTower].length - 1];
          const topTarget = state.towers[i].length > 0 ? state.towers[i][state.towers[i].length - 1] : Infinity;
          if (movingDisk < topTarget) {
            towerEl.classList.add('valid-target');
          } else {
            towerEl.classList.add('invalid-target');
          }
        }
      }
    }
  }

  // ==================== TOWER CLICK HANDLING ====================
  function handleTowerClick(towerIndex) {
    if (!state.running || state.animating) return;

    if (state.selectedTower === null) {
      // SELECT: pick up top disk from this tower
      if (state.towers[towerIndex].length === 0) {
        showGameMessage('That tower is empty. Select a tower with disks.', 'error');
        return;
      }
      state.selectedTower = towerIndex;
      showGameMessage('Now click another tower to place the disk, or click the same tower to cancel.', 'info');
      renderBoard();
      updateHUD();
    } else if (state.selectedTower === towerIndex) {
      // DESELECT: put disk back
      state.selectedTower = null;
      showGameMessage('Disk deselected.', 'info');
      renderBoard();
      updateHUD();
    } else {
      // MOVE: try to place disk
      const fromTower = state.selectedTower;
      const movingDisk = state.towers[fromTower][state.towers[fromTower].length - 1];
      const targetTop = state.towers[towerIndex].length > 0
        ? state.towers[towerIndex][state.towers[towerIndex].length - 1]
        : Infinity;

      if (movingDisk >= targetTop) {
        // INVALID MOVE: larger disk on smaller
        showGameMessage(`❌ Invalid move! Disk ${movingDisk} cannot go on disk ${targetTop}.`, 'error');
        state.selectedTower = null;
        renderBoard();
        updateHUD();
      } else {
        // VALID MOVE
        animateDisk(fromTower, towerIndex, movingDisk, () => {
          state.towers[fromTower].pop();
          state.towers[towerIndex].push(movingDisk);
          state.moves++;
          state.selectedTower = null;
          showGameMessage('', 'info');
          
          renderBoard();
          updateHUD();

          // Check completion after rendering
          if (state.towers[2].length === state.diskCount) {
            checkCompletion();
          }
        });
      }
    }
  }

  // ==================== DISK ANIMATION ====================
  function animateDisk(fromTower, toTower, movingDiskSize, callback) {
    state.animating = true;
    
    const fromStack = stacks[fromTower];
    const toStack = stacks[toTower];
    // The moving disk is the last child of the source stack
    const diskEl = fromStack.lastElementChild;
    
    // 1. Remove lifting style temporarily and disable transition to measure resting position instantly
    diskEl.style.transition = 'none';
    diskEl.classList.remove('lifting');
    const startRect = diskEl.getBoundingClientRect();
    
    // 2. Temporarily move disk to destination stack to measure end position
    toStack.appendChild(diskEl);
    const endRect = diskEl.getBoundingClientRect();
    
    // 3. Move it back to source for animation start
    fromStack.appendChild(diskEl);
    diskEl.style.transition = '';
    
    // 4. Calculate heights for the "clearance" peak
    const sourceTowerRect = towerEls[fromTower].getBoundingClientRect();
    const targetTowerRect = towerEls[toTower].getBoundingClientRect();
    // Peak height should be higher than both towers, but not off screen
    const peakY = Math.max(10, Math.min(sourceTowerRect.top, targetTowerRect.top) - 50);
    
    // Calculate translate distances relative to startRect
    let upY = peakY - startRect.top;
    // Ensure it always moves up at least 20px visually even if towers are short
    if (upY > -20) upY = -20;
    
    const moveX = endRect.left - startRect.left;
    const moveY = endRect.top - startRect.top;
    
    // 5. Create 3-stage animation (UP -> ACROSS -> DOWN)
    // Starting slightly lifted (-10px) and scaled because it was selected
    const keyframes = [
      { transform: `translate(0, -10px) scale(1.05)`, offset: 0 },
      { transform: `translate(0, ${upY}px) scale(1.05)`, offset: 0.3 },
      { transform: `translate(${moveX}px, ${upY}px) scale(1.0)`, offset: 0.7 },
      { transform: `translate(${moveX}px, ${moveY}px) scale(1.0)`, offset: 1.0 }
    ];
    
    // 6. Animate using Web Animations API
    const animation = diskEl.animate(keyframes, {
      duration: 500, // 500ms total
      easing: 'ease-in-out',
      fill: 'forwards'
    });
    
    animation.onfinish = () => {
      state.animating = false;
      // Remove any inline styles applied by animation if needed (fill: forwards keeps them, but renderBoard clears the element anyway)
      callback();
    };
  }

  // ==================== COMPLETION CHECK ====================
  function checkCompletion() {
    // All disks must be on tower 2 (destination)
    if (state.towers[2].length === state.diskCount) {
      if (state.level < 3) {
        showGameMessage(`🎉 Level ${state.level} Complete! Next level starting...`, 'success');
        
        // Silently save progress to DB so live leaderboard updates
        saveProgressSilently();

        state.level++;
        state.diskCount++;
        state.animating = true; // Block interactions while transitioning
        
        setTimeout(() => {
          // Setup next level
          state.towers = [[], [], []];
          for (let i = state.diskCount; i >= 1; i--) {
            state.towers[0].push(i);
          }
          state.selectedTower = null;
          state.animating = false;
          showGameMessage('Click a tower to select the top disk, then click another tower to move it.', 'info');
          renderBoard();
          updateHUD();
        }, 2000);
      } else {
        // All 3 levels completed
        state.running = false;
        stopTimer();

        // Finalize elapsed time
        state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);

        showGameMessage('🎉 All Levels Complete!', 'success');

        // Submit result after a brief celebration
        setTimeout(() => submitResult(), 800);
      }
      return true;
    }
    return false;
  }

  // ==================== RESULT SUBMISSION ====================
  async function saveProgressSilently() {
    const currentTimeTaken = Math.floor((Date.now() - state.startTime) / 1000);
    const payload = {
      participantName: state.participantName,
      participantId: state.participantId || undefined,
      level: state.level,
      moves: state.moves,
      timeTaken: Math.max(1, currentTimeTaken),
    };

    try {
      await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn("Silent save failed", e);
    }
  }

  // ==================== RESULT SUBMISSION ====================
  async function submitResult() {
    if (state.submitted) {
      showCompleteScreen(state.lastResult);
      return;
    }

    showScreen('complete');
    submitOverlay.classList.remove('hidden');
    submitError.textContent = '';

    // Pre-fill result display
    resultDisks.textContent = state.diskCount;
    resultMoves.textContent = state.moves;
    resultOptimal.textContent = state.minimumMoves;
    resultTime.textContent = formatTime(state.elapsedSeconds);
    resultScore.textContent = '…';
    resultRank.textContent = '…';

    const payload = {
      participantName: state.participantName,
      participantId: state.participantId || undefined,
      level: 3, // Final level
      moves: state.moves,
      timeTaken: Math.max(1, state.elapsedSeconds),
    };

    let retries = 3;
    let lastError = '';

    while (retries > 0) {
      try {
        const res = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (res.ok) {
          state.submitted = true;
          localStorage.setItem('hanoi_has_played', 'true');
          state.lastResult = {
            score: data.result.score,
            rank: data.rank,
            moves: data.result.moves,
            minimumMoves: data.result.minimumMoves,
            timeTaken: data.result.timeTaken,
            diskCount: data.result.diskCount,
          };
          submitOverlay.classList.add('hidden');
          showCompleteScreen(state.lastResult);
          return;
        } else if (res.status === 429) {
          // Duplicate submission — treat as success with client-calculated score
          state.submitted = true;
          localStorage.setItem('hanoi_has_played', 'true');
          const clientScore = calculateClientScore(state.diskCount, state.moves, state.elapsedSeconds);
          state.lastResult = {
            score: clientScore,
            rank: null,
            moves: state.moves,
            minimumMoves: state.minimumMoves,
            timeTaken: state.elapsedSeconds,
            diskCount: state.diskCount,
          };
          submitOverlay.classList.add('hidden');
          showCompleteScreen(state.lastResult);
          return;
        } else {
          lastError = data.error || 'Server error';
          retries--;
        }
      } catch (err) {
        lastError = 'Network error — check your connection';
        retries--;
      }

      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // All retries failed — show result with client-calculated score
    submitOverlay.classList.add('hidden');
    const clientScore = calculateClientScore(state.diskCount, state.moves, state.elapsedSeconds);
    state.lastResult = {
      score: clientScore,
      rank: null,
      moves: state.moves,
      minimumMoves: state.minimumMoves,
      timeTaken: state.elapsedSeconds,
      diskCount: state.diskCount,
    };
    showCompleteScreen(state.lastResult);
    submitError.textContent = `⚠ Could not save result: ${lastError}. Your score may not appear on the leaderboard.`;
  }

  /** Client-side score calculation (mirrors server) for fallback display only */
  function calculateClientScore(diskCount, moves, timeTaken) {
    const min = 53;
    const moveEff = Math.min(1, min / Math.max(1, moves));
    const timeEff = Math.min(1, 300 / Math.max(1, timeTaken));
    return Math.min(1000, Math.round((moveEff * 0.7 + timeEff * 0.3) * 1000));
  }

  function showCompleteScreen(result) {
    showScreen('complete');
    submitOverlay.classList.add('hidden');

    resultScore.textContent = result.score;
    resultRank.textContent = result.rank ? `#${result.rank}` : '—';
    resultMoves.textContent = `${result.moves} / ${result.minimumMoves}`;
    resultOptimal.textContent = result.minimumMoves;
    resultTime.textContent = formatTime(result.timeTaken);
    resultDisks.textContent = result.diskCount;
  }

    // ==================== LEADERBOARD ====================
  let lbPollInterval = null;

  async function loadLeaderboard() {
    if (!lbPollInterval) {
      lbLoading.classList.remove('hidden');
    }
    lbError.classList.add('hidden');
    // We don't hide the table here to avoid flickering on poll

    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to load leaderboard');

      const allEntries = data.leaderboard || { 5: [] };
      let entries = [];
      
      if (Array.isArray(allEntries)) {
        entries = allEntries;
      } else {
        entries = allEntries[5] || [];
      }

      // Hide sticky card initially
      stickyRankCard.classList.add('hidden');
      let currentPlayerFound = false;

      if (entries.length === 0) {
        lbBody.innerHTML = '<tr><td colspan="6" class="lb-empty">No results yet for Master Levels � be the first!</td></tr>';
      } else {
        // Smart DOM update for CSS transitions
        while (lbBody.children.length > entries.length) {
          lbBody.removeChild(lbBody.lastChild);
        }

        entries.forEach((entry, i) => {
          let tr = lbBody.children[i];
          if (!tr || tr.children.length === 1) {
            if (tr && tr.children.length === 1) lbBody.removeChild(tr);
            tr = document.createElement('tr');
            tr.innerHTML = '<td></td><td></td><td></td><td></td><td></td><td style="text-align:right"></td>';
            lbBody.appendChild(tr);
          }

          // Rank styling
          tr.className = '';
          if (i === 0) tr.classList.add('lb-rank-1');
          if (i === 1) tr.classList.add('lb-rank-2');
          if (i === 2) tr.classList.add('lb-rank-3');

          const rankMedals = ['??', '??', '??'];
          const rankDisplay = i < 3 ? rankMedals[i] : '#' + (i + 1);

          // Highlight current participant
          let isCurrentPlayer = false;
          if (state.participantName && entry.participantName === state.participantName) {
            isCurrentPlayer = true;
            currentPlayerFound = true;
            tr.classList.add('lb-highlight');
            tr.id = 'current-player-row';
            
            stickyRankValue.textContent = rankDisplay;
            stickyRankName.textContent = escapeHtml(entry.participantName);
            stickyRankStats.textContent = formatTime(Math.round(entry.timeTaken || 0)) + ' � ' + entry.moves + ' moves';
            stickyRankCard.classList.remove('hidden');
          } else {
            if (tr.id === 'current-player-row') tr.removeAttribute('id');
          }

          const newName = entry.participantName || 'Anonymous';
          if (tr.dataset.name !== newName) {
            tr.style.animation = 'none';
            tr.offsetHeight; 
            tr.style.animation = 'pulse 1s';
            tr.dataset.name = newName;
          }

          tr.children[0].innerHTML = rankDisplay;
          tr.children[1].innerHTML = escapeHtml(newName) + (isCurrentPlayer ? ' <span class="you-badge">YOU</span>' : '');
          tr.children[2].innerHTML = (entry.level || 3);
          tr.children[3].innerHTML = entry.score;
          tr.children[4].innerHTML = entry.moves + '/' + (entry.minimumMoves || '�');
          tr.children[5].innerHTML = formatTime(Math.round(entry.timeTaken || 0));
        });
      }

      lbLoading.classList.add('hidden');
      lbTable.style.display = 'table';

      // Auto-scroll to player if found and we just opened it
      if (currentPlayerFound && !lbPollInterval) {
        setTimeout(() => {
          const row = document.getElementById('current-player-row');
          if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }

      // Show participant's result info
      if (state.lastResult && state.participantName) {
        lbParticipantResult.classList.remove('hidden');
        lbParticipantResult.innerHTML = 
          '<strong>' + escapeHtml(state.participantName) + '</strong> � ' +
          'Score: <strong>' + state.lastResult.score + '</strong> | ' +
          'Moves: ' + state.lastResult.moves + '/' + state.lastResult.minimumMoves + ' | ' +
          'Time: ' + formatTime(state.lastResult.timeTaken) +
          (state.lastResult.rank ? ' | Rank: <strong>#' + state.lastResult.rank + '</strong>' : '');
      } else {
        lbParticipantResult.classList.add('hidden');
      }
    } catch (err) {
      if (!lbPollInterval) {
        lbLoading.classList.add('hidden');
        lbError.classList.remove('hidden');
        lbError.textContent = 'Failed to load leaderboard: ' + err.message;
      }
    }
    
    // Start polling if not already started
    if (!lbPollInterval) {
      lbPollInterval = setInterval(loadLeaderboard, 3000);
    }
  }

  function hideLeaderboard() {
    if (lbPollInterval) {
      clearInterval(lbPollInterval);
      lbPollInterval = null;
    }
  }

  function showLeaderboard() {
    showScreen('leaderboard');
    loadLeaderboard();
  }

  // ==================== UTILITY ====================
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ==================== EVENT LISTENERS ====================
  function bindEvents() {
    // Click sticky card to scroll to player
    if (stickyRankCard) {
      stickyRankCard.addEventListener('click', () => {
        const row = document.getElementById('current-player-row');
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    // View Leaderboard from login screen
    if (loginViewLbBtn) {
      loginViewLbBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLeaderboard();
      });
    }

    // Tower clicks (works for both mouse and touch)
    let touchHandled = false;
    towerEls.forEach((el) => {
      el.addEventListener('click', (e) => {
        // Skip if already handled by touchend
        if (touchHandled) {
          touchHandled = false;
          return;
        }
        e.preventDefault();
        const idx = parseInt(el.dataset.tower, 10);
        handleTowerClick(idx);
      });

      // Touch support — prevents double-tap zoom on mobile
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchHandled = true;
        const idx = parseInt(el.dataset.tower, 10);
        handleTowerClick(idx);
        // Reset flag after a short delay
        setTimeout(() => { touchHandled = false; }, 300);
      });
    });

    // Restart
    restartBtn.addEventListener('click', () => {
      if (state.running && !confirm('Restart the current game?')) return;
      startGame();
    });

    // View leaderboard from game
    viewLbBtn.addEventListener('click', () => {
      showLeaderboard();
    });

    // Play Again from completion screen
    playAgainBtn.addEventListener('click', () => {
      showScreen('login');
    });

    // View Leaderboard from completion screen
    viewLeaderboardBtn.addEventListener('click', () => {
      showLeaderboard();
    });

    // Leaderboard refresh
    lbRefreshBtn.addEventListener('click', () => {
      loadLeaderboard();
    });

    // Leaderboard → play
    lbPlayBtn.addEventListener('click', () => {
      showScreen('login');
    });

    // Keyboard shortcut: Ctrl+Shift+L for leaderboard
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        showLeaderboard();
      }
    });

    // Handle browser back button
    window.addEventListener('popstate', (e) => {
      // Just show login screen to prevent confusion
      showScreen('login');
    });
  }

  // ==================== INITIALIZATION ====================
  function init() {
    createParticles();
    initLogin();
    bindEvents();
    showScreen('login');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

