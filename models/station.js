

const station = {
  bindUser: (connect, sn, id) => {
    let sql = `
      UPDATE device SET owner='${id}' WHERE sn='${sn}' AND owner IS NULL
    `
    return connect.queryAsync(sql)
  },

  // 通过sn查询设备
  findDeviceBySn: (connect, sn) => {
    let sql = `
      SELECT * from device where sn='${sn}'
    `
    return connect.queryAsync(sql)
  },

  // 查找设备与用户的分享关系
  findDeviceShareBySnAndId: (connect, sn, id) => {
    let sql = `
      SELECT * FROM device_user WHERE sn='${sn}' AND user='${id}'
    `
    return connect.queryAsync(sql)
  },

  // 创建设备与用户的分享关系
  createShare: (connect, sn, id) => {
    let sql = `
      INSERT INTO device_user
      SET sn='${sn}',user='${id}'
    `
    return connect.queryAsync(sql)
  },

  // 取消分享
  deleteShare: (connect, sn, user) => {
    let sql = `
      DELETE FROM device_user
      WHERE sn='${sn}' AND user='${user}'
    `
    return connect,queryAsync(sql)
  },

  // 解绑拥有设备
  unbindOwnStation: (connect, sn) => {

  },

  // 解绑被分享设备

  

  // 查询设备拥有者
  getStationOwner: (connect, sn) => {
    let sql = `
      SELECT u.id, u.username,u.avatarUrl,u.createdAt from device as d 
      LEFT JOIN user AS u
      ON d.owner = u.id
      where sn='${sn}' AND owner IS NOT NULL
    `
    return connect.queryAsync(sql)
  },

  // 查询设备分享者
  getStationSharer: (connect, sn) => {
    let sql = `
      SELECT u.id, u.username,u.avatarUrl,u.createdAt from device_user AS du
      LEFT JOIN user AS u
      on du.user=u.id
      where sn='${sn}'
    `
    return connect.queryAsync(sql)
  },


  // 查询用户拥有的设备
  getStationBelongToUser: (connect, id) => {
    let sql = `
      SELECT d.sn,i.online,i.onlineTime,i.offlineTime,i.LANIP,i.name FROM device AS d 
      LEFT JOIN deviceInfo AS i
      ON d.sn=i.sn
      WHERE owner='${id}'
    `
    return connect.queryAsync(sql)
  },

  // 查询分享给用户的设备
  getStationSharedToUser: (connect, id) => {
    let sql = `
      SELECT d.sn,du.createdAt,d.owner,i.online,i.onlineTime,i.offlineTime,i.LANIP,i.name
      FROM device_user AS du
      JOIN device AS d ON du.sn=d.sn
      LEFT JOIN deviceInfo as i ON du.sn=i.sn
      WHERE user='${id}'
    `
    return connect.queryAsync(sql)
  }
}

module.exports = station