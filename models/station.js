

const station = {
  // 绑定
  bindUser: (connect, sn, userId) => {
    let sql = `
      UPDATE device SET owner='${userId}' WHERE sn='${sn}' AND owner IS NULL
    `
    return connect.queryAsync(sql)
  },

  // 解绑
  unbindUser: (connect, sn, userId) => {
    let sql = `
      UPDATE device SET owner=null WHERE sn='${sn}'
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
  createShare: (connect, sn, id, setting) => {
    let sql = `
      INSERT INTO device_user
      SET sn='${sn}',user='${id}'
    `

    for (let item in setting) {
      sql += `,${item}=${setting[item]}`
    }
    return connect.queryAsync(sql)
  },

  // 更新设备下用户设置
  updateStationUser: (connect, sn, userId, setting) => {
    let sql = `
      UPDATE device_user
      SET cloud=1
    `
    for (let item in setting) {
      sql += `,${item}=${setting[item]}`
    }
    sql += ` WHERE sn='${sn}' AND user='${userId}'`
    return connect.queryAsync(sql)
  },

  // 记录设备与手机号分享
  recordShare: (connect, sn, owner, phone, userId, type, setting) => {
    let state = userId? 'done': 'todo'
    let sql = `
      INSERT INTO device_userRecord
      SET sn='${sn}',owner='${owner}', phone='${phone}',
      type='${type}', state='${state}', setting='${setting}'
    `
    if (userId) sql+= `, user='${userId}'`
    return connect.queryAsync(sql)
  },

  // 查询手机号被分享记录
  getShareRecord: (connect, phone, type, state) => {
    let sql = `
      SELECT * FROM device_userRecord
      WHERE phone='${phone}' AND type='${type}' AND state='${state}'
    `
    return connect.queryAsync(sql)
  },

  // 更新分享记录
  updateShareRecord: (connect, id, state) => {
    let sql = `
      UPDATE device_userRecord
      SET state='${state}'
      WHERE id='${id}'
    `
    return connect.queryAsync(sql)
  },

  // 删除分享
  deleteShare: (connect, sn, user) => {
    let sql = `
      DELETE FROM device_user
      WHERE sn='${sn}' AND user='${user}'
    `
    return connect.queryAsync(sql)
  },

  cleanShare: (connect, sn) => {
    let sql = `
      DELETE FROM device_user
      WHERE sn='${sn}'
    `
    return connect.queryAsync(sql)
  },

  // 查询设备拥有者
  getStationOwner: (connect, sn) => {
    let sql = `
      SELECT u.id, u.username,u.avatarUrl,u.nickName from device as d 
      LEFT JOIN user AS u
      ON d.owner = u.id
      where sn='${sn}' AND owner IS NOT NULL
    `
    return connect.queryAsync(sql)
  },

  // 查询设备分享者
  getStationSharer: (connect, sn) => {
    let sql = `
      SELECT du.*, u.id, u.username,u.avatarUrl,u.nickName from device_user AS du
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
      SELECT d.sn,d.owner,
      i.online,i.onlineTime,i.offlineTime,i.LANIP,i.name,
      du.createdAt
      FROM device_user AS du
      JOIN device AS d ON du.sn=d.sn
      LEFT JOIN deviceInfo as i ON du.sn=i.sn
      WHERE user='${id}'
    `
    return connect.queryAsync(sql)
  }
}

module.exports = station