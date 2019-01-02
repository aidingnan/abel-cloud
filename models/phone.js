/*
 * @Author: harry.liu 
 * @Date: 2018-12-29 13:26:44 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-12-29 15:14:20
 */
const phone = {

  // 查询手机号是否被注册
  checkPhone: (connect, phone) => {
    let sql = `
      SELECT * FROM phone
      WHERE phoneNumber = ${phone} AND user IS NOT NULL`
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

  // 检验手机ticket
  getSmsCodeTicketInfo: (connect, ticket) => {
    let sql = `
      SELECT * FROM userSmsCodeRecord
      WHERE id='${ticket}' AND status='toConsumed'
    `
    return connect.queryAsync(sql)
  },

    /**
   * 使用手机号注册用户
   * 1. 使用事务
   * 2. 插入用户表
   * 3. 插入手机表
   * 4. 更新ticket状态
   * 5. 返回结果检验
   */
  signUpWithPhone: (connect, id, phone, ticket, password, type) => {
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
      WHERE phone='${phone}' AND id='${ticket}' AND verified=1 AND type='${type}'
      AND unix_timestamp(time) BETWEEN @start AND @end;`
    return connect.queryAsync(sql)
  },
}

module.exports = phone