

const station = {
  // 绑定
  bindUser: (connect, sn, userId) => {
    let sql = `
      UPDATE device SET owner='${userId}' 
      WHERE sn='${sn}'
    `
    return connect.queryAsync(sql)
  },

  // 解绑
  unbindUser: (connect, sn, newUser) => {
    let sql = `
      UPDATE device SET owner=
    `
    if (newUser) sql += `'${newUser}'`
    else sql += `null`
    sql += ` WHERE sn='${sn}';`

    return connect.queryAsync(sql)
  },

  // 通过sn查询设备
  findDeviceBySn: (connect, sn) => {
    let sql = `
      SELECT * from device where sn='${sn}'
    `
    return connect.queryAsync(sql)
  },

  // 查找设备的分享用户
  findDeviceShareBySnAndId: (connect, sn, id) => {
    let sql = `
      SELECT * FROM device_user 
      WHERE sn='${sn}' AND user='${id}' AND device_user.delete=0 AND isOwner=0
    `
    return connect.queryAsync(sql)
  },

  // 创建设备与用户的关系
  createRelation: (connect, sn, id, setting, isOwner) => {
    let sql = `
      INSERT INTO device_user
      SET sn='${sn}',user='${id}',isOwner='${isOwner}'
      ON DUPLICATE KEY UPDATE 
      device_user.delete=0,deleteCode=null,disable=0,isOwner='${isOwner}'
    `
    for (let item in setting) {
      sql += `,${item}=${setting[item]}`
    }
    return connect.queryAsync(sql)
  },

  // 更新关系
  updateRelation: (connect, sn, user, isOwner, isDelete) => {
    let sql = `
    
    `
    return connect.queryAsync(sql)
  },

  // 删除关系
  deleteRelation: (connect, sn, user, code) => {
    let deleteCode = code ? `'${code}'` : `null`
    let sql = `
      UPDATE device_user
      SET device_user.delete=1,deleteCode=${deleteCode}
      WHERE sn='${sn}' AND user='${user}'
    `
    return connect.queryAsync(sql)
  },

  // 禁用/启用
  disableUser: (connect, sn, user, disable) => {
    let sql = `
      UPDATE device_user
      SET disable='${disable}'
      WHERE sn='${sn}' AND user='${user}'
    `
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
  recordShare: (connect, sn, owner, phone, userId, type, setting, operationCode, state) => {
    let s = state ? state : userId ? 'done' : 'todo'
    let sql = `
      INSERT INTO device_userRecord
      SET sn='${sn}',owner='${owner}', 
      type='${type}', state='${s}'
    `
    if (phone) sql += `, phone='${phone}'`
    if (userId) sql += `, user='${userId}'`
    if (setting) sql += `, setting='${setting}'`
    if (operationCode) sql += `, operationCode='${operationCode}'`
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

  getDeleteRecord: (connect, sn, userId, operationCode) => {
    let sql = `
      SELECT * FROM device_userRecord
      WHERE sn='${sn}' AND user='${userId}' AND state='todo' AND operationCode='${operationCode}'
    `
    return connect.queryAsync(sql)
  },

  // 更新记录
  updateShareRecord: (connect, id, state) => {
    let sql = `
      UPDATE device_userRecord
      SET state='${state}'
      WHERE id='${id}'
    `
    return connect.queryAsync(sql)
  },

  updateShareRecords: (connect, sn, userId, type, state) => {
    let sql = `
      UPDATE device_userRecord
      SET state='${state}'
      WHERE sn='${sn}' AND user='${userId}' AND type='${type}'
    `
    return connect.queryAsync(sql)
  },

  // 查询设备拥有者
  getStationOwner: (connect, sn) => {
    let sql = `
    SELECT u.id, u.username,u.avatarUrl,u.nickName, du.isOwner, du.delete from device_user AS du
    LEFT JOIN user AS u
    on du.user=u.id
    where sn='${sn}' AND isOwner=1
    `
    return connect.queryAsync(sql)
  },

  // 查询设备分享者
  getStationSharer: (connect, sn) => {
    let sql = `
      SELECT u.id, u.username,u.avatarUrl,u.nickName, du.isOwner, du.cloud, du.publicSpace, du.disable, du.delete from device_user AS du
      LEFT JOIN user AS u
      on du.user=u.id
      where sn='${sn}' AND isOwner=0
    `
    return connect.queryAsync(sql)
  },

  getStationUsers: (connect, sn) => {
    let sql = `
    SELECT u.id, u.username,u.avatarUrl,u.nickName, du.isOwner, du.cloud, du.publicSpace, du.disable, du.delete from device_user AS du
      LEFT JOIN user AS u
      on du.user=u.id
      where sn='${sn}'
    `
    return connect.queryAsync(sql)
  },

  // 查询用户拥有的设备
  getStationBelongToUser: (connect, id) => {
    let sql = `
    SELECT d.sn,d.owner,d.type,
    i.online,i.onTime,i.offTime,i.LANIP,i.name,
    du.createdAt, du.delete, du.deleteCode, ui.time
    FROM device_user AS du
    JOIN device AS d ON du.sn=d.sn
    LEFT JOIN deviceInfo as i ON du.sn=i.sn
    LEFT JOIN (SELECT * FROM  userDeviceUseInfo GROUP BY userId,sn ORDER BY time DESC ) AS ui ON d.sn=ui.sn AND ui.userId='${id}'
    WHERE du.user='${id}' AND du.delete <> 1 AND du.isOwner=1
    `
    return connect.queryAsync(sql)
  },

  // 查询分享给用户的设备
  getStationSharedToUser: (connect, id) => {
    let sql = `
      SELECT d.sn,d.owner,d.type,
      i.online,i.onTime,i.offTime,i.LANIP,i.name,
      du.createdAt, du.delete, du.deleteCode, ui.time
      FROM device_user AS du
      JOIN device AS d ON du.sn=d.sn
      LEFT JOIN deviceInfo as i ON du.sn=i.sn
      LEFT JOIN (SELECT * FROM  userDeviceUseInfo GROUP BY userId,sn ORDER BY time DESC ) AS ui ON d.sn=ui.sn AND ui.userId='${id}'
      WHERE du.user='${id}' AND du.delete <> 1 AND du.isOwner=0
    `
    return connect.queryAsync(sql)
  },

  // 更新签名
  updateSignature: (connect, sn, signature, raw) => {
    let sql = `
      UPDATE deviceInfo 
      SET signature='${signature}', raw='${raw}'
      WHERE sn='${sn}'
    `
    return connect.queryAsync(sql)
  },

  getStationUpgrade: (connect) => {
    let sql = `
      SELECT * FROM upgrade
    `
    return connect.queryAsync(sql)
  }
}

module.exports = station