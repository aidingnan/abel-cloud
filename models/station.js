

const station = {
  bindUser: (connect, sn, id) => {
    let sql = `
      UPDATE device SET owner='${id}' WHERE sn='${sn}' AND owner IS NULL
    `
    return connect.queryAsync(sql)
  },

  findDevice: (connect, sn) => {
    let sql = `
      SELECT * from device as d JOIN user as u ON d.owner=u.id where sn='${sn}'
    `
    return connect.queryAsync(sql)
  }
}

module.exports = station