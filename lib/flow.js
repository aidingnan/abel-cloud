const fs = require('fs')
const path = require('path')
const { Transform } = require('stream')

class Flow extends Transform {
  constructor(options, db, userId, field, limit) {
    super(options)
    this.total = 0
    this.part = 0
    this.db = db
    this.userId = userId
    this.field = field
    this.busy = false
    this.limit = false
    this.cache = null


    this.timer = setInterval(() => {
      if (this.busy) return console.log('is busy')
      let sql = `
        SELECT SUM(flowUp) AS flowUp, SUM(flowDown) AS flowDown FROM userFlow 
        WHERE DATE_FORMAT( day, '%Y%m' ) = DATE_FORMAT( CURDATE( ) , '%Y%m' )
        AND userId='${this.userId}'
      `
      this.db.queryAsync(sql, (err, data) => {
        if (err) console.log(err)
        else {
          let flow = data[0][this.field]
          if (flow + this.total > 100000000) {
            this.limit = true
          }
        }
      })
      // this.record()
    }, 2000)

    this.limitTimer = setInterval(() => {
      this.part = 0
      if (this.cache) {
        console.log('继续传输')
        this.part = 0
        let { chunk, callback } = this.cache
        this.cache = null
        
        callback(null, chunk)
      }
    }, 1000)
  }

  _transform(chunk, encoding, callback) {
    this.total += chunk.length
    this.part += chunk.length
    if (this.limit && this.part > 307200) {
      console.log('限速 暂停', this.part, ' ', this.total)
      this.cache = { chunk, callback }
    } else callback(null, chunk)
  }

  _flush(callback) {
    callback()
  }

  _final(callback) {
    this.clean()
    callback()
  }

  async record(cb) {
    try {
      this.busy = true
      let sql = `
        INSERT INTO userFlow(userId,day,${this.field})
        VALUES('${this.userId}', CURDATE(), '${this.total}')
        ON DUPLICATE KEY UPDATE  ${this.field} = ${this.field} + ${this.total}
      `
      let result = await this.db.queryAsync(sql)
      if (cb) cb()

    } catch (error) { console.log(error) }
  }

  async clean() {
    clearInterval(this.timer)
    clearInterval(this.limitTimer)
    if (!this.busy) await this.record()
  }
}

module.exports = Flow