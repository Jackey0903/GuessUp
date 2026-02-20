const { players } = require('../../utils/players.js');

const MAX_GUESSES = 8;

Page({
  data: {
    players: [], // All players for search
    target: null, // The hidden player
    guesses: [], // Array of guess objects with feedback
    inputVal: '',
    searchResults: [],
    gameState: 'playing', // playing, won, lost
    showModal: false,

    // Filter Data
    conferences: [],
    allTeams: [],
    teams: [],
    positions: [],
    teamConfMap: {},
    confIndex: 0,
    teamIndex: 0,
    posIndex: 0,
    selectedConf: '',
    selectedTeam: '',
    selectedPos: '',

    // Multiplayer fields
    roomId: null,
    // Multiplayer fields
    roomId: null,
    isHost: false,
    role: null, // legacy
    opponents: [],
    winnerName: '',
    watcher: null,

    // Multi-Round fields
    totalRounds: 0,
    currentRound: 1,
    roundStartTime: 0,
    roundScoreSubmitted: false,
    timeRemaining: 60,
    timeFormatted: '00:60',
    timerId: null,
    leaderboard: []
  },

  onUnload() {
    this.stopTimer();
    if (this.data.watcher) {
      this.data.watcher.close();
    }
  },

  onLoad(options) {
    this.setData({ players });
    this.initFilters();

    if (options.roomId) {
      this.setData({
        roomId: options.roomId
      });
      this.initMultiplayer();
    } else {
      this.startNewGame();
    }
  },

  initFilters() {
    // Extract unique values
    const confs = new Set();
    const teamsList = new Set();
    const posList = new Set();
    const teamConfMap = {};

    this.data.players.forEach(p => {
      if (p.conf_cn) confs.add(p.conf_cn);
      if (p.team_cn) {
        teamsList.add(p.team_cn);
        if (p.conf_cn) teamConfMap[p.team_cn] = p.conf_cn;
      }
      if (p.pos_cn) posList.add(p.pos_cn);
    });

    const allTeams = Array.from(teamsList).sort();

    this.setData({
      conferences: Array.from(confs).sort(),
      allTeams: allTeams,
      teams: allTeams,
      teamConfMap: teamConfMap,
      positions: Array.from(posList).sort()
    });
  },

  onUnload() {
    if (this.data.watcher) {
      this.data.watcher.close();
    }
  },

  async initMultiplayer() {
    const db = wx.cloud.database();
    const app = getApp();
    const myId = app.globalData.playerId;
    const { roomId } = this.data;

    wx.showLoading({ title: '加载房间数据...', mask: true });

    try {
      // 1. Fetch the target player ID from the room
      const res = await db.collection('rooms').doc(roomId).get();
      const roomData = res.data;

      const currentRound = roomData.currentRound || 1;
      const targetId = roomData.targetIds ? roomData.targetIds[currentRound - 1] : roomData.targetId;
      const target = this.data.players.find(p => p.id === targetId);
      const isHost = roomData.players && roomData.players[myId] ? roomData.players[myId].isHost : false;

      if (target) {
        const parts = target.name.split(' ');
        if (parts.length >= 2) {
          target.initials = parts[0][0] + parts[1][0];
        } else {
          target.initials = target.name.substring(0, 2).toUpperCase();
        }
      }

      this.setData({
        isHost: isHost,
        target: target,
        guesses: [],
        inputVal: '',
        searchResults: [],
        gameState: 'playing',
        showModal: false,
        opponents: [],
        winnerName: '',
        totalRounds: roomData.totalRounds || 0,
        currentRound: currentRound,
        roundStartTime: roomData.roundStartTime || null,
        roundScoreSubmitted: false,
        leaderboard: []
      });

      wx.hideLoading();

      if (this.data.totalRounds > 0 && this.data.roundStartTime) {
        this.startTimer(this.data.roundStartTime);
      }

      // 2. Start watching for opponent updates
      const watcher = db.collection('rooms').doc(roomId).watch({
        onChange: (snapshot) => {
          if (snapshot.docs.length === 0) return;
          const currentRoom = snapshot.docs[0];
          const app = getApp();
          const myId = app.globalData.playerId;

          const playersObj = currentRoom.players || {};
          const opps = [];
          let someoneWon = false;
          let winnerName = '';

          for (const pid in playersObj) {
            if (pid === myId) continue;
            opps.push({
              id: pid,
              name: playersObj[pid].name || '对手',
              guesses: playersObj[pid].guesses || 0
            });
          }

          if (this.data.totalRounds > 0) {
            // MULTI-ROUND MODE
            if (currentRoom.state === 'finished' && this.data.gameState !== 'finished') {
              this.showFinalScoreboard(currentRoom);
            } else if (currentRoom.currentRound > this.data.currentRound) {
              this.startNewRound(currentRoom);
            }
            this.setData({ opponents: opps });
          } else {
            // SINGLE-ROUND LEGACY MODE
            if (currentRoom.winner && currentRoom.winner !== myId && this.data.gameState === 'playing') {
              someoneWon = true;
              winnerName = playersObj[currentRoom.winner]?.name || '对手';
            }
            this.setData({ opponents: opps });

            if (someoneWon) {
              this.setData({
                gameState: 'lost',
                showModal: true,
                winnerName: winnerName
              });
              wx.vibrateLong();
              wx.showToast({ title: `${winnerName} 率先猜中了！`, icon: 'none', duration: 3000 });
            }
          }
        },
        onError: (err) => {
          console.error('Watch error in game:', err);
        }
      });

      this.setData({ watcher });
    } catch (e) {
      console.error(e);
      wx.hideLoading();
      wx.showToast({ title: '房间已过期', icon: 'none' });
      setTimeout(() => { wx.navigateBack(); }, 2000);
    }
  },

  stopTimer() {
    if (this.data.timerId) {
      clearInterval(this.data.timerId);
      this.setData({ timerId: null });
    }
  },

  startTimer(startTime) {
    this.stopTimer();
    const duration = 120; // 120 seconds per round

    const updateTimer = () => {
      const start = parseInt(startTime);
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      let rem = duration - elapsed;

      if (rem <= 0) {
        rem = 0;
        this.stopTimer();
        this.handleRoundTimeout();
      }

      // Format time remaining MM:SS
      const m = Math.floor(rem / 60).toString().padStart(2, '0');
      const s = (rem % 60).toString().padStart(2, '0');

      this.setData({
        timeRemaining: rem,
        timeFormatted: `${m}:${s}`
      });
    };

    // run once immediately
    updateTimer();
    const id = setInterval(updateTimer, 1000);
    this.setData({ timerId: id });
  },

  handleRoundTimeout() {
    if (this.data.gameState !== 'playing') {
      if (this.data.isHost && this.data.roomId) {
        this.scheduleNextRound();
      }
      return;
    }

    this.setData({
      gameState: 'lost',
      showModal: true,
      winnerName: '时间到！'
    });
    wx.vibrateLong();

    // Automatically submit score as failed if we hadn't already won
    if (this.data.roomId && this.data.totalRounds > 0 && !this.data.roundScoreSubmitted) {
      this.syncToCloud(this.data.guesses.length, false, true);
      this.setData({ roundScoreSubmitted: true });
    }

    if (this.data.isHost && this.data.roomId) {
      this.scheduleNextRound();
    }
  },

  scheduleNextRound() {
    setTimeout(() => {
      const db = wx.cloud.database();
      const { roomId, currentRound, totalRounds } = this.data;
      const nextRound = currentRound + 1;

      if (nextRound > totalRounds) {
        db.collection('rooms').doc(roomId).update({
          data: { state: 'finished' }
        });
      } else {
        db.collection('rooms').doc(roomId).update({
          data: {
            state: 'round_' + nextRound,
            currentRound: nextRound,
            roundStartTime: Date.now()
          }
        });
      }
    }, 4000); // 4 seconds break
  },

  startNewRound(roomData) {
    this.stopTimer();
    const targetId = roomData.targetIds[roomData.currentRound - 1];
    const target = this.data.players.find(p => p.id === targetId);

    if (target) {
      const parts = target.name.split(' ');
      if (parts.length >= 2) {
        target.initials = parts[0][0] + parts[1][0];
      } else {
        target.initials = target.name.substring(0, 2).toUpperCase();
      }
    }

    this.setData({
      target: target,
      guesses: [],
      inputVal: '',
      searchResults: [],
      gameState: 'playing',
      showModal: false,
      winnerName: '',
      currentRound: roomData.currentRound,
      roundStartTime: roomData.roundStartTime || Date.now(),
      roundScoreSubmitted: false
    });

    this.startTimer(this.data.roundStartTime);
    wx.vibrateShort({ type: 'medium' });
    wx.showToast({ title: '新的一轮开始了！', icon: 'none' });
  },

  showFinalScoreboard(roomData) {
    this.stopTimer();
    const playersObj = roomData.players || {};
    const lb = [];
    for (const k in playersObj) {
      lb.push({
        id: k,
        name: playersObj[k].name || '玩家',
        totalCorrect: playersObj[k].totalCorrect || 0,
        totalAttempts: playersObj[k].totalAttempts || 0,
        totalTimeMs: playersObj[k].totalTimeMs || 0,
        timeSecs: ((playersObj[k].totalTimeMs || 0) / 1000).toFixed(1)
      });
    }

    // Sort
    lb.sort((a, b) => {
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
      // If correct matches, shortest time wins
      return a.totalTimeMs - b.totalTimeMs;
    });

    this.setData({
      gameState: 'finished',
      showModal: false,
      leaderboard: lb
    });
    wx.vibrateLong();
  },

  startNewGame() {
    // Random Mode Implementation
    // Pick a purely random player every time so the user can play continuously
    const dailyIndex = Math.floor(Math.random() * this.data.players.length);

    // For testing/dev, maybe we want random? 
    // User requested "Sigdle" style which is Daily.
    // Let's stick to Daily for now as default.
    const target = this.data.players[dailyIndex];
    if (target) {
      // Compute Initials for Avatar
      const parts = target.name.split(' ');
      if (parts.length >= 2) {
        target.initials = parts[0][0] + parts[1][0];
      } else {
        target.initials = target.name.substring(0, 2).toUpperCase();
      }
    }
    // console.log('Target Player:', target.name, dateStr, dailyIndex);

    this.setData({
      target: target,
      guesses: [],
      inputValue: '',
      inputVal: '', // Ensure both are cleared just in case
      searchResults: [],
      gameState: 'playing',
      gameOver: false,
      gameWon: false,
      showModal: false
    });
  },

  onInput(e) {
    this.setData({ inputVal: e.detail.value });
    this.updateSearchResults();
  },

  onConfChange(e) {
    const idx = e.detail.value;
    const selectedConf = this.data.conferences[idx];

    // Filter teams based on selected conference
    const filteredTeams = this.data.allTeams.filter(t => this.data.teamConfMap[t] === selectedConf);

    // Check if current selectedTeam is still valid
    let newSelectedTeam = this.data.selectedTeam;
    if (newSelectedTeam && this.data.teamConfMap[newSelectedTeam] !== selectedConf) {
      newSelectedTeam = '';
    }

    this.setData({
      confIndex: idx,
      selectedConf: selectedConf,
      teams: filteredTeams,
      selectedTeam: newSelectedTeam
    });
    this.updateSearchResults();
  },

  onTeamChange(e) {
    const idx = e.detail.value;
    const selectedTeam = this.data.teams[idx];
    const targetConf = this.data.teamConfMap[selectedTeam];

    let newSelectedConf = this.data.selectedConf;
    let newConfIndex = this.data.confIndex;

    // Auto-select conference if necessary
    if (targetConf && targetConf !== newSelectedConf) {
      newSelectedConf = targetConf;
      newConfIndex = this.data.conferences.indexOf(targetConf);
    }

    const filteredTeams = this.data.allTeams.filter(t => this.data.teamConfMap[t] === newSelectedConf);

    this.setData({
      teamIndex: filteredTeams.indexOf(selectedTeam),
      selectedTeam: selectedTeam,
      selectedConf: newSelectedConf,
      confIndex: newConfIndex,
      teams: filteredTeams
    });
    this.updateSearchResults();
  },

  onPosChange(e) {
    const idx = e.detail.value;
    this.setData({
      posIndex: idx,
      selectedPos: this.data.positions[idx]
    });
    this.updateSearchResults();
  },

  resetFilters() {
    this.setData({
      selectedConf: '',
      selectedTeam: '',
      selectedPos: '',
      inputVal: '',
      teams: this.data.allTeams
    });
    this.updateSearchResults();
  },

  updateSearchResults() {
    const { inputVal, selectedConf, selectedTeam, selectedPos, players, guesses } = this.data;

    // If no text input and no filters are selected, hide results
    if (!inputVal && !selectedConf && !selectedTeam && !selectedPos) {
      this.setData({ searchResults: [] });
      return;
    }

    const lowerVal = (inputVal || '').toLowerCase();

    const results = players.filter(p => {
      // 1. Exclude already guessed
      if (guesses.some(g => g.name.value === p.name)) return false;

      // 2. Filter match
      if (selectedConf && p.conf_cn !== selectedConf) return false;
      if (selectedTeam && p.team_cn !== selectedTeam) return false;
      if (selectedPos && p.pos_cn !== selectedPos) return false;

      // 3. Text search match (only if there is text input)
      if (lowerVal) {
        const nameMatch = p.name.toLowerCase().includes(lowerVal);
        const aliasMatch = p.aliases && p.aliases.some(alias => alias.toLowerCase().includes(lowerVal));
        if (!nameMatch && !aliasMatch) return false;
      }

      return true;
    }).slice(0, 50); // Show up to 50 results if using filters, so user can scroll roster

    this.setData({ searchResults: results });
  },

  selectPlayer(e) {
    const player = e.currentTarget.dataset.player;
    this.submitGuess(player);
  },

  submitGuess(player) {
    if (!player) return;

    const target = this.data.target;
    // Use Metric Height for comparison
    const targetHeight = target.height_cm;
    const guessHeight = player.height_cm;

    // Logic: Exact (Green), Partial (Yellow - within range), None (Gray)
    const getStatus = (val, targetVal, threshold = 0) => {
      if (val === targetVal) return 'correct';
      if (Math.abs(val - targetVal) <= threshold) return 'partial';
      return 'incorrect';
    };

    const getArrow = (val, targetVal) => {
      if (val < targetVal) return 'up';
      if (val > targetVal) return 'down';
      return '';
    };

    const feedback = {
      name: {
        value: player.name,
        status: player.name === target.name ? 'correct' : 'incorrect'
      },
      team: { value: player.team_cn, status: player.team === target.team ? 'correct' : 'incorrect' },
      conf: { value: player.conf_cn, status: player.conf === target.conf ? 'correct' : 'incorrect' },
      div: { value: player.div_cn, status: player.div === target.div ? 'correct' : 'incorrect' },
      pos: {
        value: player.pos_cn,
        status: player.pos === target.pos ? 'correct' : (
          (player.pos.includes(target.pos) || target.pos.includes(player.pos)) ? 'partial' : 'incorrect'
        )
      }, // Partial if share position (e.g. G vs G-F)
      height: {
        value: `${player.height_cm}cm`,
        status: getStatus(player.height_cm, targetHeight, 5), // Partial if within 5cm
        arrow: getArrow(player.height_cm, targetHeight)
      },
      age: {
        value: player.age,
        status: getStatus(player.age, target.age, 2), // Partial if within 2 years
        arrow: getArrow(player.age, target.age)
      },
      number: {
        value: player.number,
        status: getStatus(parseInt(player.number), parseInt(target.number), 2), // Partial if within 2 numbers
        arrow: getArrow(parseInt(player.number), parseInt(target.number))
      }
    };

    const newGuesses = [feedback, ...this.data.guesses];
    const won = player.name === target.name;
    let newState = 'playing';

    if (won) {
      newState = 'won';
    } else if ((!this.data.roomId || this.data.totalRounds === 0) && newGuesses.length >= MAX_GUESSES) {
      newState = 'lost';
    }

    this.setData({
      guesses: newGuesses,
      inputVal: '',
      searchResults: [],
      gameState: newState,
      showModal: newState !== 'playing'
    });

    // Multiplayer sync
    if (this.data.roomId) {
      if (!this.data.roundScoreSubmitted) {
        this.syncToCloud(newGuesses.length, won);
        if (newState !== 'playing' && this.data.totalRounds > 0) {
          this.setData({ roundScoreSubmitted: true });
        }
      }
    }

    if (newState !== 'playing') {
      wx.vibrateLong();
    } else {
      wx.vibrateShort({ type: 'medium' });
    }

    // But typically Poeltl puts new guesses at the TOP. 
    // If we put them at the top, we don't need to scroll down.
    // Let's scroll to the search input area to ensure it's visible for the next guess.
    // Scroll to top
    if (wx.pageScrollTo) {
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });
    }
  },

  syncToCloud(guessesCount, won, isTimeout = false) {
    const db = wx.cloud.database();
    const _ = db.command;
    const { roomId, currentRound, roundStartTime, totalRounds } = this.data;
    const app = getApp();
    const myId = app.globalData.playerId;
    const updateData = {
      [`players.${myId}.guesses`]: guessesCount
    };

    if (totalRounds > 0) {
      if (won || isTimeout) {
        const timeSpentMs = roundStartTime ? (Date.now() - parseInt(roundStartTime)) : 0;
        const cappedTime = timeSpentMs > 120000 ? 120000 : timeSpentMs;

        updateData[`players.${myId}.scores`] = _.push([{
          round: currentRound,
          guessed: won,
          attempts: guessesCount,
          timeMs: cappedTime
        }]);
        updateData[`players.${myId}.totalCorrect`] = _.inc(won ? 1 : 0);
        updateData[`players.${myId}.totalAttempts`] = _.inc(guessesCount); // Just for stats
        updateData[`players.${myId}.totalTimeMs`] = _.inc(cappedTime);
      }
    } else {
      if (won) {
        updateData.winner = myId;
      }
    }

    db.collection('rooms').doc(roomId).update({
      data: updateData
    }).catch(console.error);
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  onShareAppMessage() {
    const { gameState, guesses, target } = this.data;
    let title = '吾猜(哈登冠名版) - 每天一位神秘NBA球星，你能猜对吗？';

    if (gameState === 'won') {
      title = `太牛了！我只用了 ${guesses.length} 次就猜出了今天的神秘球星是 ${target.name}！`;
    } else if (gameState === 'lost') {
      title = `太难了！我连猜8次都没猜出今天的神秘球星，谁来帮帮我！`;
    }

    return {
      title: title,
      path: '/pages/index/index',
      imageUrl: ''
    };
  }
});
