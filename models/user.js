/*
 * @Author: harry.liu 
 * @Date: 2018-09-06 14:51:25 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-09-26 11:16:48
 */

const user = {
  // 查询手机号是否被注册
  getUserByPhone: (connect, phone) => {
    let sql = `SELECT * FROM phone 
      WHERE phoneNumber = ${phone} AND user IS NOT NULL`
    return connect.queryAsync(sql)
  },

  signUpWithPhone: (connect, id, phone, password) => {
    let sql = `
      BEGIN;
      SET @now = NOW();
      INSERT INTO user
      VALUES('${id}', '${phone}', PASSWORD('${password}'), @now, @now, 1);
      INSERT INTO phone
      VALUES('${phone}', '${id}', @now, @now)
      ON DUPLICATE KEY UPDATE user='${id}';
      COMMIT;`
    return connect.queryAsync(sql)
  },

  loginWithPhone: (connect, username, password) => {
    let sql = `
      SELECT id,username,phoneNumber FROM user,phone WHERE user.id=phone.user 
      AND user.password=PASSWORD('${password}')
      AND phone.phoneNumber='${username}'
    `
    return connect.queryAsync(sql)
  },

  getUserById: (connect, id) => {
    let sql = `
      SELECT * FROM user
      WHERE id='${id}'
    `
    return connect.queryAsync(sql)
  },

  // 通过unionid查找微信用户
  getWechatByUnionid: (connect, unionid) => {
    let sql = `
      SELECT * FROM wechat
      WHERE unionid='${unionid}'
    `
    return connect.queryAsync(sql)
  },

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
      SELECT unionid,user,u.id,u.username FROM wechat as w
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

  // 绑定手机
  addPhone: (connect, id, phone) => {
    let sql = `
      INSERT INTO phone(phoneNumber, user)
      VALUES('${phone}', '${id}');
    `
    return connect.queryAsync(sql)
  },

  // 查询绑定手机
  getPhone: (connect, id) => {
    let sql = `
      SELECT phoneNumber,createdAt FROM phone
      WHERE user='${id}'
    `
    return connect.queryAsync(sql)
  }


}

module.exports = user