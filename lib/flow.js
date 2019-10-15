const fs = require('fs')
const path = require('path')
const { Transform } = require('stream')
const debug = require('debug')('app:store')

class Manager {
  constructor() {
    this.task = new Map()
    this.timer = setInterval(this.clean.bind(this), 2000)
    this.busy = false
  }

  createOrPush(userId, task) {
    // 插入任务
    let value = this.task.get(userId) || new Set()
    value.add(task)
    this.task.set(userId, value)
    // console.log('插入任务完成', this.task.get(userId).size)
  }

  clean() {
    if (this.busy) return
    this.busy = true
    for (let [key, setValue] of this.task.entries()) {
      for (let item of setValue.values()) {
        if (item.finish) {
          // console.log('任务完成', item.parent.ctx.jobId)
          setValue.delete(item)
        }
      }
      // if (setValue.size !== 0) console.log(`用户${key} 剩余任务数量为 ${setValue.size}`)
    }
    this.busy = false
  }
}

var manager = new Manager()

class Flow extends Transform {
  constructor(options, db, userId, field, parent) {
    super(options)
    this.parent = parent
    this.db = db
    this.userId = userId
    this.field = field
    this.cache = null // 
    this.total = 0 // 总传输流量
    this.part = 0 // 当前块大小
    this.highSpeedFlow = 0 // 已使用高速流量
    this.busy = false // 是否已记录使用情况
    this.limit = true // 是否需要限速
    this.speed = 500 * 1024
    this.useHighFlow = false // 高速流量开关
    this.finish = false
    manager.createOrPush(this.userId, this)


    this.timer = setInterval(async () => {
      if (this.busy) return
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
        } else {
          this.useHighFlow = false
        }
          
      } catch (error) {
        console.error(error)
      }

    }, 2000)

    this.limitTimer = setInterval(() => {
      this.part = 0
      if (this.cache) {
        debug('继续传输')
        let { chunk, callback } = this.cache
        this.cache = null

        callback(null, chunk)
      }
    }, 250)
  }

  _transform(chunk, encoding, callback) {
    if (!this.begin) this.begin = new Date()
    this.total += chunk.length // 总流量
    this.part += chunk.length
    let count = manager.task.get(this.userId).size || 1
    if (this.limit && !this.useHighFlow && this.part > this.speed / count / 4 ) {
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
    // console.log(`${this.parent.ctx.jobId} 传输完成， 总流量为${(this.total)/ 1024 / 1024} M， 使用的高速流量为${(this.highSpeedFlow)/ 1024 / 1024} M`)
    // console.log(this.begin, new Date())
    try {
      let sql = `
        INSERT INTO userFlow(userId,day,${this.field},highFlow, sn)
        VALUES('${this.userId}', CURDATE(), ${this.total},${this.highSpeedFlow}, ${this.parent.ctx.req.params.sn})
        ON DUPLICATE KEY UPDATE  ${this.field} = ${this.field} + ${this.total},
        highFlow = highFlow + ${this.highSpeedFlow}
      `
      let sql1 = `
        UPDATE user SET flow = flow - ${this.highSpeedFlow}
        WHERE id='${this.userId}'
      `

      await this.db.queryAsync(sql)
      await this.db.queryAsync(sql1)
      if (cb) cb()

    } catch (error) { console.log(error) }
  }

  async clean() {
    if (this.busy) return
    this.busy = true
    this.finish = true
    clearInterval(this.timer)
    clearInterval(this.limitTimer)
    await this.record()
  }
}

module.exports = Flow