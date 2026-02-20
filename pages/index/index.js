Page({
  data: {
    showModal: false,
    showJoinInput: false,
    joinCode: ''
  },

  startGame() {
    wx.vibrateShort({ type: 'medium' });
    wx.navigateTo({
      url: "/pages/game/game"
    });
  },

  toggleJoinInput() {
    wx.vibrateShort({ type: 'light' });
    this.setData({
      showJoinInput: !this.data.showJoinInput
    });
  },

  onRoomCodeInput(e) {
    this.setData({ joinCode: e.detail.value });
  },

  joinRoomByCode() {
    const code = this.data.joinCode;
    if (code.length === 4) {
      wx.vibrateShort({ type: 'medium' });
      wx.navigateTo({
        url: `/pages/room/room?roomId=${code}`
      });
    } else {
      wx.showToast({ title: '请输入完整的4位数字房间号', icon: 'none' });
    }
  },

  startVS() {
    wx.vibrateShort({ type: 'medium' });
    wx.navigateTo({
      url: "/pages/room/room"
    });
  },

  showRules() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ showModal: true });
  },

  hideRules() {
    wx.vibrateShort({ type: 'light' });
    this.setData({ showModal: false });
  },

  onShareAppMessage() {
    return {
      title: '吾猜(哈登冠名版) - 每天一位神秘NBA球星，你能猜对吗？',
      path: '/pages/index/index',
      imageUrl: '' // Optional: custom share image
    };
  }
});
