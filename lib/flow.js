const fs = require('fs')
const path = require('path')
const { Transform } = require('stream')

class Flow extends Transform {
  constructor(options, db, userId, field) {
    super(options)
    this.cache = 0
    this.db = db
    this.userId = userId
    this.field = field
    this.busy = false
    /**
     * 自动记录流量
     * 1. 检查标记
     * 2. 检查流量
     */
    this.timer = setInterval(() => {
      if (this.busy) return console.log('is busy')
      if (this.cache == 0) return console.log('is zero')
      this.record()
    }, 1000)
  }

  _transform(chunk, encoding, callback) {
    this.cache += chunk.length
    this.push(chunk)
    callback()
  }

  _flush(callback) {
    callback()
  }

  _final(callback) {
    clearInterval(this.timer)
    this.record(callback)
  }

  record(cb) {
    try {
      this.busy = true
      let size = this.cache
      this.cache = 0
      let sql = `
        INSERT INTO userFlow(userId,day,${this.field})
        VALUES('${this.userId}', curdate(), '${size}')
        ON DUPLICATE KEY UPDATE  ${this.field} = ${this.field} + ${size}
      `
      this.db.query(sql, (err) => {
        if (err) console.log(err)
        this.busy = false
        if (cb) cb()
        
      })
    } catch (error) { console.log(error) }
  }
}

module.exports = Flow