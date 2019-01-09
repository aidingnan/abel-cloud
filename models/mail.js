/*
 * @Author: harry.liu 
 * @Date: 2019-01-09 15:41:55 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2019-01-09 16:50:22
 */

const mail = {
  // 查询邮件绑定信息
  getMail: (connect, mail) => {
    let sql = `
      SELECT * FROM mail
      LEFT JOIN user ON mail.user=user.id
      WHERE mail.mail='${mail}'
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

  // 查询邮箱验证码
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

  // 更新邮箱验证码状态
  updateMailCode: (connect, mail, code, type, verified, status) => {
    let sql = `
      UPDATE userMailCodeRecord SET verified=${verified}, status='${status}'
      WHERE mail='${mail}' AND code='${code}' AND verified=0 AND type='${type}';
    `
    return connect.queryAsync(sql)
  },

  // 更新邮箱token状态
  updateMailRecordStatus: (connect, id, status) => {
    let sql = `
      UPDATE userMailCodeRecord SET status='${status}'
      WHERE id='${id}'
    `
    return connect.queryAsync(sql)
  },

  // 检验邮箱ticket
  getMailCodeTicketInfo: (connect, ticket) => {
    let sql = `
        SELECT * FROM userMailCodeRecord
        WHERE id='${ticket}' AND status='toConsumed'
      `
    return connect.queryAsync(sql)
  }
}

module.exports = mail