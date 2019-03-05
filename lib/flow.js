const fs = require('fs')
const path = require('path')
const { Transform } = require('stream')

class Flow extends Transform {
  constructor(options, db, userId, field, limit) {
    super(options)
    this.total = 
    this.cache = 0
    this.part = 0
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

    this.limit = setInterval(() => {

    }, 1000)
  }

  _transform(chunk, encoding, callback) {
    this.cache += chunk.length
    this.part += chunk.length
    this.total += chunk.length
    this.push(chunk)
    // if (this.part >=)
    callback()
  }

  _flush(callback) {
    callback()
  }

  async _final(callback) {
    console.log(this.total)
    clearInterval(this.timer)
    if (!this.busy && this.cache !== 0) await this.record()
    callback()
  }

  async record(cb) {
    try {
      this.busy = true
      let size = this.cache
      this.cache = 0
      let sql = `
        INSERT INTO userFlow(userId,day,${this.field})
        VALUES('${this.userId}', curdate(), '${size}')
        ON DUPLICATE KEY UPDATE  ${this.field} = ${this.field} + ${size}
      `
      let result = await this.db.queryAsync(sql)
      this.busy = false
      if (cb) cb()

    } catch (error) { console.log(error) }
  }

  clean() {
    clearInterval(this.timer)
  }
}

module.exports = Flow