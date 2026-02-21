App({
  globalData: {
    env: "cloud1-4gavsni7e030b67a",
    playerId: null
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 及以上基础库以使用云能力");
      return;
    }

    const env = this.globalData.env;
    wx.cloud.init({
      env: env,
      traceUser: true
    });

    let playerId = wx.getStorageSync('playerId');
    if (!playerId) {
      playerId = 'P_' + Math.random().toString(36).substring(2, 8);
      wx.setStorageSync('playerId', playerId);
    }
    this.globalData.playerId = playerId;
  }
});
