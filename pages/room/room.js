const db = wx.cloud.database();
const app = getApp();

Page({
    data: {
        roomId: '',
        isHost: false,
        playersArray: [],
        roomState: 'waiting',
        statusText: '正在创建房间...',
        watcher: null,
        _realDbId: ''
    },

    onLoad(options) {
        if (options.roomId) {
            this.joinRoom(options.roomId);
        } else {
            this.createRoom();
        }
    },

    onUnload() {
        this.closeWatcher();
    },

    closeWatcher() {
        if (this.data.watcher) {
            this.data.watcher.close();
            this.setData({ watcher: null });
        }
    },

    async createRoom() {
        this.setData({ isHost: true });
        wx.showLoading({ title: '生成随机题目...', mask: true });

        try {
            const { players } = require('../../utils/players.js');
            const randomIndex = Math.floor(Math.random() * players.length);
            const target = players[randomIndex];

            const shortCode = Math.floor(1000 + Math.random() * 9000).toString();
            const myId = app.globalData.playerId;

            const res = await db.collection('rooms').add({
                data: {
                    createdAt: db.serverDate(),
                    shortCode: shortCode,
                    state: 'waiting',
                    targetId: target.id,
                    capacity: 4,
                    players: {
                        [myId]: {
                            name: '房主',
                            isHost: true,
                            guesses: 0
                        }
                    },
                    winner: null
                }
            });

            this.setData({
                roomId: shortCode,
                _realDbId: res._id,
                statusText: '等待挑战者加入...'
            });

            wx.hideLoading();
            this.watchRoom(res._id);

        } catch (err) {
            console.error(err);
            wx.hideLoading();
            wx.showToast({ title: '建房失败，请检查云开发配置', icon: 'none' });
        }
    },

    async joinRoom(shortCode) {
        this.setData({
            isHost: false,
            roomId: shortCode,
            statusText: '正在查找房间...'
        });

        wx.showLoading({ title: '连线中...', mask: true });

        try {
            const queryRes = await db.collection('rooms').where({
                shortCode: shortCode,
                state: 'waiting'
            }).get();

            if (queryRes.data.length === 0) {
                throw new Error('Room not found or already playing');
            }

            const roomData = queryRes.data[0];
            const realDbId = roomData._id;
            const myId = app.globalData.playerId;

            // Generate a random guest name
            const guestNames = ["挑战者", "黑马", "新秀", "老将"];
            const rName = guestNames[Math.floor(Math.random() * guestNames.length)] + Math.floor(Math.random() * 100);

            await db.collection('rooms').doc(realDbId).update({
                data: {
                    [`players.${myId}`]: {
                        name: rName,
                        isHost: false,
                        guesses: 0
                    }
                }
            });

            this.setData({
                _realDbId: realDbId,
                statusText: '连线成功！等待房主开始...'
            });

            wx.hideLoading();
            this.watchRoom(realDbId);

        } catch (err) {
            console.error(err);
            wx.hideLoading();
            wx.showToast({ title: '房间号无效或已满', icon: 'none' });
            setTimeout(() => { this.leaveRoom(); }, 2000);
        }
    },

    watchRoom(roomId) {
        const watcher = db.collection('rooms').doc(roomId).watch({
            onChange: (snapshot) => {
                console.log('Room Snapshot:', snapshot);
                if (snapshot.docs.length === 0) return;

                const roomData = snapshot.docs[0];
                const playersObj = roomData.players || {};

                // Format players array for UI
                const playersArr = Object.keys(playersObj).map(k => ({
                    id: k,
                    ...playersObj[k]
                }));

                // Sort array: Host first
                playersArr.sort((a, b) => b.isHost - a.isHost);

                this.setData({
                    playersArray: playersArr,
                    roomState: roomData.state
                });

                if (roomData.state === 'playing') {
                    this.setData({ statusText: '游戏即将开始！' });
                    wx.vibrateLong();

                    setTimeout(() => {
                        this.closeWatcher();
                        wx.redirectTo({
                            url: `/pages/game/game?roomId=${this.data._realDbId}`
                        });
                    }, 1000);
                }
            },
            onError: (err) => {
                console.error('Watch Error', err);
            }
        });

        this.setData({ watcher });
    },

    async startGame() {
        if (!this.data.isHost) return;
        wx.showLoading({ title: '发布开始指令...', mask: true });

        try {
            await db.collection('rooms').doc(this.data._realDbId).update({
                data: { state: 'playing' }
            });
            wx.hideLoading();
            // Watcher will navigate to game
        } catch (e) {
            console.error(e);
            wx.hideLoading();
            wx.showToast({ title: '开始失败', icon: 'none' });
        }
    },

    async devSimulateJoin() {
        wx.showLoading({ title: '模拟连线...', mask: true });
        try {
            const devId = 'P_SIM_' + Math.floor(Math.random() * 9000);
            await db.collection('rooms').doc(this.data._realDbId).update({
                data: {
                    [`players.${devId}`]: {
                        name: '测试AI',
                        isHost: false,
                        guesses: 0
                    }
                }
            });
            wx.hideLoading();
        } catch (e) {
            console.error(e);
            wx.hideLoading();
            wx.showToast({ title: '模拟加入失败', icon: 'none' });
        }
    },

    onShareAppMessage() {
        if (this.data.roomId && this.data.isHost) {
            return {
                title: '快来加入我的 NBA 球星竞猜大混战！',
                path: `/pages/room/room?roomId=${this.data.roomId}`,
                imageUrl: ''
            };
        }
        return {
            title: '吾猜(哈登冠名版) - 多人实时联机',
            path: '/pages/index/index'
        };
    },

    leaveRoom() {
        wx.navigateBack({
            delta: 1,
            fail: () => {
                wx.redirectTo({ url: '/pages/index/index' });
            }
        });
    }
});
