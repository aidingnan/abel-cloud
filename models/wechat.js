/*
 * @Author: harry.liu 
 * @Date: 2018-12-29 13:26:30 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2019-03-06 17:23:57
 */


const wechat = {
  // 创建微信用户或更新用户信息
  insertIntoWechat: (connect, unionid, nickname, avatarUrl) => {
    let sql = `
      INSERT INTO wechat
      SET unionid='${unionid}',nickname='${nickname}',avatarUrl='${avatarUrl}'
      ON DUPLICATE KEY UPDATE nickname='${nickname}',avatarUrl='${avatarUrl}'
    `
    return connect.queryAsync(sql)
  },

  // 查找微信用户及关联用户信息
  findWechatAndUserByUnionId: (connect, unionid) => {
    let sql = `
      SELECT unionid,user,avatarUrl FROM wechat as w
      LEFT JOIN user as u on w.user=u.id
      WHERE unionid='${unionid}'
    `
    return connect.queryAsync(sql)
  },

  // 绑定微信
  addWechat: (connect, id, unionid) => {
    let sql = `
      UPDATE wechat SET user='${id}'
      WHERE user IS NULL && unionid='${unionid}'
    `
    return connect.queryAsync(sql)
  },

  // 查询微信
  getUserWechat: (connect, userId) => {
    let sql = `
      SELECT w.* FROM wechat as w
      LEFT JOIN user as u 
      ON w.user=u.id
      WHERE w.user='${userId}'
    `
    return connect.queryAsync(sql)
  },

  // 解绑微信
  unbindWechat: (connect, userId, unionid) => {
    let sql = `
      DELETE FROM wechat
      WHERE unionid='${unionid}' AND user='${userId}'
    `
    return connect.queryAsync(sql)
  },
}

module.exports = wechat