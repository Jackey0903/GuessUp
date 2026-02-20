App({
  globalData: {
    env: "cloud1-4gavsni7e030b67a"
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
  }
});
