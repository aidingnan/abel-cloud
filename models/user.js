/*
 * @Author: harry.liu 
 * @Date: 2018-09-06 14:51:25 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-09-07 18:45:16
 */

const user = {
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
      VALUES('${phone}', 1, '${id}', @now, @now);
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
  }


}

module.exports = user