/*
 * @Author: harry.liu 
 * @Date: 2018-09-06 14:51:25 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-11-20 16:48:48
 */

const user = {
  // 查询手机号是否被注册
  getUserByPhone: (connect, phone) => {
    let sql = `SELECT u.* FROM phone as p
      LEFT JOIN user AS u ON u.id=p.user
      WHERE phoneNumber = ${phone} AND user IS NOT NULL`
    return connect.queryAsync(sql)
  },

  // 使用手机号注册用户
  signUpWithPhone: (connect, id, phone, code, password, type) => {
    let sql = `
      BEGIN;
      SET @now = NOW();
      SET @end = unix_timestamp(NOW());
      SET @start = unix_timestamp(SUBTIME(NOW(), 15 * 60));
      INSERT INTO user (id, username, password, createdAt, updatedAt, status)
      VALUES('${id}', '${phone}', PASSWORD('${password}'), @now, @now, 1);
      INSERT INTO phone
      VALUES('${phone}', '${id}', @now, @now)
      ON DUPLICATE KEY UPDATE user='${id}';
      UPDATE userSmsCodeRecord SET verified=1,status='consumed'
      WHERE phone='${phone}' AND code='${code}' AND verified=0 AND type='${type}'
      AND unix_timestamp(time) BETWEEN @start AND @end;
      COMMIT;`
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

  // 使用userId查询用户
  getUserInfo: (connect, userId) => {
    let sql = `
      SELECT * FROM user WHERE id = '${userId}'
    `
    return connect.queryAsync(sql)
  },

  // 使用手机号查询用户
  getUserWithPhone: (connect, phone) => {
    let sql = `
      SELECT * FROM phone as p
      LEFT JOIN user as u ON p.user=u.id
      WHERE phoneNumber='${phone}'
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
      SELECT unionid,user FROM wechat as w
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

  // 记录验证码
  addPasswordCodeRecord: (connect, id, phone, code, type, status) => {
    let sql = `
      INSERT INTO userSmsCodeRecord(id, phone, code, type, status)
      VALUES('${id}', '${phone}', '${code}', '${type}', '${status}');
    `
    return connect.queryAsync(sql)
  },

  // 查询验证码
  getSmsCodeUserRecord: (connect, id, phone) => {
    let sql = `
      SELECT * FROM userSmsCodeRecord
      WHERE id='${id}' AND phone='${phone}'
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

  // 更新修改密码token状态
  updateSmsRecordStatus: (connect, id, phone, status) => {
    let sql = `
      UPDATE userSmsCodeRecord SET status='${status}'
      WHERE id='${id}' AND phone='${phone}'
    `
    return connect.queryAsync(sql)
  },

  // 查询邮件绑定信息
  getMail: (connect, mail) => {
    let sql = `
      SELECT * FROM mail
      WHERE mail='${mail}'
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
      UPDATE user SET mail='${mail}'
      WHERE id='${userId}';
      COMMIT;
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
      UPDATE user SET mail=null
      WHERE id='${userId}';
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

  // 创建短信验证码
  createSmsCode: (connect, id, phone, code, type) => {
    let sql = `
      INSERT INTO userSmsCodeRecord(id, phone, code, type, status)
      VALUES('${id}', '${phone}', '${code}', '${type}', 'toConsumed')
    `
    return connect.queryAsync(sql)
  },

  // 查询短信验证码有效
  getSmsCode: (connect, phone, code, type) => {
    let sql = `
    SET @end = unix_timestamp(NOW());
    SET @start = unix_timestamp(SUBTIME(NOW(), 15 * 60));
    SELECT * FROM userSmsCodeRecord
    WHERE phone='${phone}' AND code='${code}' AND verified=0 AND type='${type}'
    AND unix_timestamp(time) BETWEEN @start AND @end;
  `
    return connect.queryAsync(sql)
  },

  // 更新验证码状态
  updateSmsCode: (connect, phone, code, type, verified, status) => {
    let sql = `
      SET @end = unix_timestamp(NOW());
      SET @start = unix_timestamp(SUBTIME(NOW(), 15 * 60));
      UPDATE userSmsCodeRecord SET verified=${verified}, status='${status}'
      WHERE phone='${phone}' AND code='${code}' AND verified=0 AND type='${type}'
      AND unix_timestamp(time) BETWEEN @start AND @end;
    `
    return connect.queryAsync(sql)
  },

  // 检验ticket
  getSmsCodeTicketInfo: (connect, ticket) => {
    let sql = `
      SELECT * FROM userSmsCodeRecord
      WHERE id='${ticket}' AND status='toConsumed'
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