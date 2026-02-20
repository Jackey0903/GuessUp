const db = wx.cloud.database();

Page({
    data: {
        roomId: '',
        isHost: false,
        guestJoined: false,
        statusText: '正在创建房间...',
        watcher: null
    },

    onLoad(options) {
        if (options.roomId) {
            // User is joining via a shared link
            this.joinRoom(options.roomId);
        } else {
            // User is creating a new room
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

            // Generate a 4-digit numeric short code
            const shortCode = Math.floor(1000 + Math.random() * 9000).toString();

            const res = await db.collection('rooms').add({
                data: {
                    createdAt: db.serverDate(),
                    shortCode: shortCode,
                    state: 'waiting',
                    hostId: 'host_temp_id',
                    guestId: null,
                    targetId: target.id,
                    hostGuesses: 0,
                    guestGuesses: 0,
                    winner: null
                }
            });

            this.setData({
                roomId: shortCode, // Display the 4-digit code instead of the long ID
                _realDbId: res._id, // Keep the real ID for watcher
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
            // Find the room by 4-digit short code
            const queryRes = await db.collection('rooms').where({
                shortCode: shortCode,
                state: 'waiting'
            }).get();

            if (queryRes.data.length === 0) {
                throw new Error('Room not found or already playing');
            }

            const realDbId = queryRes.data[0]._id;

            // Update the room to indicate guest has joined
            await db.collection('rooms').doc(realDbId).update({
                data: {
                    state: 'playing',
                    guestId: 'guest_temp_id'
                }
            });

            this.setData({
                _realDbId: realDbId,
                guestJoined: true,
                statusText: '连线成功！准备载入...'
            });

            wx.hideLoading();

            wx.vibrateLong();
            setTimeout(() => {
                wx.redirectTo({
                    url: `/pages/game/game?roomId=${realDbId}&role=guest`
                });
            }, 1500);

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

                if (this.data.isHost && roomData.state === 'playing' && !this.data.guestJoined) {
                    // Guest just joined
                    this.setData({
                        guestJoined: true,
                        statusText: '挑战者已就位！'
                    });

                    wx.vibrateLong();

                    setTimeout(() => {
                        this.closeWatcher();
                        wx.redirectTo({
                            url: `/pages/game/game?roomId=${this.data._realDbId}&role=host`
                        });
                    }, 1500);
                }
            },
            onError: (err) => {
                console.error('Watch Error', err);
            }
        });

        this.setData({ watcher });
    },

    async devSimulateJoin() {
        wx.showLoading({ title: '模拟连线...', mask: true });
        try {
            await db.collection('rooms').doc(this.data.roomId).update({
                data: {
                    state: 'playing',
                    guestId: 'dev_guest_id'
                }
            });
            wx.hideLoading();
            // The watcher will handle the rest!
        } catch (e) {
            console.error(e);
            wx.hideLoading();
            wx.showToast({ title: '模拟加入失败', icon: 'none' });
        }
    },

    onShareAppMessage() {
        if (this.data.roomId && this.data.isHost) {
            return {
                title: '我发起了一场 NBA 球星竞猜 1v1 挑战，敢来应战吗？',
                path: `/pages/room/room?roomId=${this.data.roomId}`,
                imageUrl: '' // Optional vs image
            };
        }
        return {
            title: '吾猜(哈登冠名版) - 每天一位神秘NBA球星',
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
