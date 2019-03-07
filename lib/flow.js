const fs = require('fs')
const path = require('path')
const { Transform } = require('stream')
const debug = require('debug')('app:store')

class Manager {
  constructor() {
    this.task = new Map()
  }

  createOrPush(userId, task) {
    // 插入任务
    let value = this.task.get(userId) || []
    value.push(task)
    this.task.set(userId, value)
    console.log('插入任务完成', this.task.get(userId).length)
  }

  clean(userId) {
    let value = this.task.get(userId)
    value.forEach(item => {
      if (item.finish) value.splice(value.indexOf(item), 1)
    })
    console.log('删除任务完成', this.task.get(userId).length)
  }
}

var manager = new Manager()

class Flow extends Transform {
  constructor(options, db, userId, field, limit) {
    super(options)
    this.db = db
    this.userId = userId
    this.field = field
    this.cache = null // 
    this.total = 0 // 总传输流量
    this.part = 0 // 当前块大小
    this.highSpeedFlow = 0 // 已使用高速流量
    this.busy = false // 是否已记录使用情况
    this.limit = true // 是否需要限速
    this.speed = 0
    this.useHighFlow = false // 高速流量开关
    this.finish = false
    manager.createOrPush(this.userId, this)


    this.timer = setInterval(async () => {
      if (this.busy) return console.log('is busy')
      let sql = `
        SELECT SUM(flowUp) AS flowUp, SUM(flowDown) AS flowDown FROM userFlow 
        WHERE DATE_FORMAT( day, '%Y%m' ) = DATE_FORMAT( CURDATE( ) , '%Y%m' )
        AND userId='${this.userId}'
      `
      let sql1 = `SELECT flow FROM user WHERE id='${this.userId}'`

      try {
        let flowInfo = await this.db.queryAsync(sql)
        let userInfo = await this.db.queryAsync(sql1)
        let flow = flowInfo[0][this.field]
        let highSpeedFlow = userInfo[0].flow
        // console.log(`本月已传输流量： ${(flow + this.total)/ 1024 / 1024} M`)

        // 本月免费流量超出
        if (flow + this.total > 1073741824) {
          debug('开启限速')
          this.limit = true
        } 
        this.speed = 1024 * 1024
        if (flow + this.total > 1073741824 * 2) this.speed = 500 * 1024

        // 用户存在高速流量
        if (this.highSpeedFlow < highSpeedFlow) {
          debug('使用高速流量')
          this.useHighFlow = true
          this.limit = false
        } else {
          this.useHighFlow = false
        }
          
      } catch (error) {
        console.log(error)
      }

    }, 2000)

    this.limitTimer = setInterval(() => {
      this.part = 0
      console.log(`速度为 ${this.part / 1024} M`)
      if (this.cache) {
        debug('继续传输')
        let { chunk, callback } = this.cache
        this.cache = null

        callback(null, chunk)
      }
    }, 1000)
  }

  _transform(chunk, encoding, callback) {
    this.total += chunk.length // 总流量
    this.part += chunk.length
    let count = manager.task.get(this.userId).length || 1
    if (this.limit && !this.useHighFlow && this.part > this.speed / count ) {
      // 限速且没有高速流量
      debug('限速 暂停', this.part, ' ', this.total)
      
      this.cache = { chunk, callback }
    } else if (this.limit && this.useHighFlow) {
      // 超出免费流量，存在流量包
      this.part = 0
      this.highSpeedFlow += chunk.length
      callback(null, chunk)
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
    console.log(`传输完成， 总流量为${(this.total)/ 1024 / 1024} M， 使用的高速流量为${(this.highSpeedFlow)/ 1024 / 1024} M`)
    try {
      this.busy = true
      let sql = `
        INSERT INTO userFlow(userId,day,${this.field},highFlow)
        VALUES('${this.userId}', CURDATE(), ${this.total},${this.highSpeedFlow})
        ON DUPLICATE KEY UPDATE  ${this.field} = ${this.field} + ${this.total},
        highFlow = highFlow + ${this.highSpeedFlow}
      `
      let sql1 = `
        UPDATE user SET flow = flow - ${this.highSpeedFlow}
        WHERE id='${this.userId}'
      `

      await this.db.queryAsync(sql)
      await this.db.queryAsync(sql1)
      manager.clean(this.userId)
      if (cb) cb()

    } catch (error) { console.log(error) }
  }

  async clean() {
    this.finish = true
    clearInterval(this.timer)
    clearInterval(this.limitTimer)
    
    if (!this.busy) await this.record()
  }
}

module.exports = Flow