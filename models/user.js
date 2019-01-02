/*
 * @Author: harry.liu 
 * @Date: 2018-09-06 14:51:25 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-12-29 16:08:46
 */

const user = {

  // 使用手机号查询用户
  getUserWithPhone: (connect, phone) => {
    let sql = `
      SELECT * FROM phone AS p
      LEFT JOIN user AS u ON p.user=u.id
      WHERE phoneNumber='${phone}'
    `
    return connect.queryAsync(sql)
  },

  // 换手机号
  replacePhone: (connect, userId, oldPhone, newPhone) => {
    let sql = `
      BEGIN;
      DELETE FROM phone
      WHERE phoneNumber='${oldPhone}' AND user='${userId}';

      INSERT INTO phone
      SET phoneNumber='${newPhone}',user='${userId}';

      UPDATE user SET username='${newPhone}'
      WHERE id='${userId}'
    `
    return connect.queryAsync(sql)
  },

  // 使用账号密码登录
  loginWithPhone: (connect, username, password) => {
    let sql = `
      SELECT * FROM user,phone WHERE user.id=phone.user 
      AND user.password=PASSWORD('${password}')
      AND phone.phoneNumber='${username}'
    `
    return connect.queryAsync(sql)
  },

  // 验证密码
  confirmPassword: (connect, userId, password) => {
    let sql = `
      SELECT * FROM user
      WHERE id='${userId}' AND password=PASSWORD('${password}')
    `
    return connect.queryAsync(sql)
  },

  // 使用邮箱密码登录
  loginWithMail: (connect, mail, password) => {
    let sql = `
      SELECT * FROM user,mail WHERE user.id=mail.user
      AND user.password=PASSWORD('${password}')
      AND mail.mail='${mail}'
    `
    return connect.queryAsync(sql)
  },

  // 使用userId查询用户
  getUserInfo: (connect, userId) => {
    let sql = `
      SELECT * FROM user WHERE id = '${userId}'
    `
    return connect.queryAsync(sql)
  },

  // 使用邮箱查询用户
  getUserWithMail: (connect, mail) => {
    let sql = `
      SELECT * FROM mail as m
      LEFT JOIN user as u ON m.user=u.id
      WHERE m.mail='${mail}'
    `
    return connect.queryAsync(sql)
  },

  // 记录登录信息
  recordLoginInfo: (connect, userId, clientId, type) => {
    let sql = `
      INSERT INTO userLoginInfo 
      (userId, clientId, type)
      VALUES ('${userId}', '${clientId}', '${type}')

    `
    return connect.queryAsync(sql)
  },

  // 记录使用信息
  recordUseInfo: (connect, userId, clientId, type, sn) => {
    let sql = `
      INSERT INTO userDeviceUseInfo
      (userId, clientId, type, sn)
      VALUES('${userId}', '${clientId}', '${type}', '${sn}')
    `
    return connect.queryAsync(sql)
  },

  // 查询使用记录
  getUseRecordInfo: (connect, userId, clientId, type) => {
    let sql = `
      SELECT * FROM userDeviceUseInfo
      WHERE userId='${userId}' AND clientId='${clientId}' AND type='${type}'
      ORDER BY time DESC LIMIT 1 
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

  // 查询绑定手机
  getPhone: (connect, id) => {
    let sql = `
      SELECT phoneNumber,createdAt FROM phone
      WHERE user='${id}'
    `
    return connect.queryAsync(sql)
  },

  // 更新头像
  updateAvatar: (connect, userId, location) => {
    let sql = `
      UPDATE user SET avatarUrl='${location}'
      WHERE id='${userId}'
    `
    return connect.queryAsync(sql)
  },

  // 更新昵称
  updateNickName: (connect, userId, nickName) => {
    let sql = `
      UPDATE user SET nickName='${nickName}'
      WHERE id='${userId}'
    `
    return connect.queryAsync(sql)
  },

  // 修改密码
  setNewPassword: (connect, userId, password) => {
    let sql = `
      UPDATE user SET password=PASSWORD('${password}')
      WHERE id='${userId}'
    `
    return connect.queryAsync(sql)
  },

  // 更新token状态
  updateSmsRecordStatus: (connect, id, status) => {
    let sql = `
      UPDATE userSmsCodeRecord SET status='${status}'
      WHERE id='${id}'
    `
    return connect.queryAsync(sql)
  },

  // 查询邮件绑定信息
  getMail: (connect, mail) => {
    let sql = `
      SELECT * FROM mail
      LEFT JOIN user ON mail.user=user.id
      WHERE mail.mail='${mail}'
    `
    return connect.queryAsync(sql)
  },

  // 根据userId查询mail
  getMailWithUserId: (connect, userId) => {
    let sql = `
      SELECT mail FROM mail
      WHERE user='${userId}'
    `
    return connect.queryAsync(sql)
  },

  // 创建邮件验证码
  createMailCode: (connect, id, mail, code, type) => {
    let sql = `
      INSERT INTO userMailCodeRecord(id, mail, code, type, status)
      VALUES('${id}', '${mail}', '${code}', '${type}', 'toConsumed')
    `
    return connect.queryAsync(sql)
  },

  // 查询有效验证码
  getMailCode: (connect, mail, code, type) => {
    let sql = `
      SET @end = unix_timestamp(NOW());
      SET @start = unix_timestamp(SUBTIME(NOW(), 15 * 60));
      SELECT * FROM userMailCodeRecord
      WHERE mail='${mail}' AND code='${code}' AND verified=0 AND type='${type}'
      AND unix_timestamp(time) BETWEEN @start AND @end;
    `
    return connect.queryAsync(sql)
  },

  // 更新验证码状态
  getMailToken: (connect, mail, code, type, verified, status) => {
    let sql = `
      SET @end = unix_timestamp(NOW());
      SET @start = unix_timestamp(SUBTIME(NOW(), 15 * 60));
      UPDATE userMailCodeRecord SET verified=${verified}, status='${status}'
      WHERE mail='${mail}' AND code='${code}' AND verified=0 AND type='${type}'
      AND unix_timestamp(time) BETWEEN @start AND @end;
    `
    return connect.queryAsync(sql)
  },

  // 检验ticket
  getMailCodeTicketInfo: (connect, ticket) => {
    let sql = `
        SELECT * FROM userMailCodeRecord
        WHERE id='${ticket}' AND status='toConsumed'
      `
    return connect.queryAsync(sql)
  },

  // 绑定邮箱
  bindMail: (connect, mail, code, userId) => {
    let sql = `
      BEGIN;
      SET @end = unix_timestamp(NOW());
      SET @start = unix_timestamp(SUBTIME(NOW(), 15 * 60));
      UPDATE userMailCodeRecord SET verified=1,status='consumed'
      WHERE mail='${mail}' AND code='${code}' AND verified=0 AND type='bind'
      AND unix_timestamp(time) BETWEEN @start AND @end;
      INSERT INTO mail(mail, user)
      VALUES('${mail}', '${userId}');
    `
    return connect.queryAsync(sql)
  },

  // 解绑邮箱
  unBindMail: (connect, mail, code, userId) => {
    let sql = `
      BEGIN;
      SET @end = unix_timestamp(NOW());
      SET @start = unix_timestamp(SUBTIME(NOW(), 15 * 60));
      UPDATE userMailCodeRecord SET verified=1,status='consumed'
      WHERE mail='${mail}' AND code='${code}' AND verified=0 AND type='unbind'
      AND unix_timestamp(time) BETWEEN @start AND @end;
      DELETE FROM mail
      WHERE mail='${mail}' AND user='${userId}';
      COMMIT;
    `
    return connect.queryAsync(sql)
  },

  // 查询绑定邮箱
  getUserMail: (connect, userId) => {
    let sql = `
      SELECT * FROM mail
      WHERE user='${userId}'
    `
    return connect.queryAsync(sql)
  },

  // 更新安全级别
  updateSafeTy: (connect, userId, safeTy) => {
    let addition = ``
    if (safeTy !== 0) {
      addition = `AND id in(SELECT user FROM mail)`
    }
    let sql = `
      UPDATE user SET safeTy=${safeTy}
      WHERE id='${userId}' 
    `
    sql += addition
    return connect.queryAsync(sql)
  }

}

module.exports = user