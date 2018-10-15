/*
 * @Author: harry.liu 
 * @Date: 2018-10-10 16:49:15 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-10-15 18:23:33
 */

const EventEmitter = require('events').EventEmitter
const uuid = require('uuid')
const E = require('../lib/error')

/**
 * 状态机基类
 * server state: init -> notice -> pending -> finish
 */
class State {
  constructor(ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    console.log(`${this.ctx.jobId} enter state : ${this.constructor.name}`)
    this.enter(...args)
  }

  setState(NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args)
  }

  enter() {}

  exit() {}
}

/**
 * 初始化：获取参数
 */
class Init extends State {
  constructor(ctx) {
    super(ctx)
    this.name = 'init'
  }

  enter() {
    let server = this.ctx
    let jobId = this.ctx.jobId
    this.ctx.ctx.map.set(jobId, server)
    let body
    if (server.req.method == 'GET') body = server.req.query
    else if (server.req.method == 'POST') body = server.req.body
    let { method, resource } = body

    this.ctx.manifest = {
      method, resource, body,
      sessionId: jobId,
      user: { id: this.ctx.req.auth.id }
    }

    this.setState(Notice)
  }
}

/**
 * 通知：发布消息
 */
class Notice extends State {
  constructor(ctx) {
    super(ctx)
    this.name = 'notice'
  }

  async enter() {
    try {
      let sn = this.ctx.req.params.sn
      let topic = `cloud/${sn}/pipe`
      let qos = 1
      let payload = JSON.stringify(this.ctx.manifest)
      let obj = { topic, qos, payload}
      publishAsync(obj)
      this.setState(Pending)
    } catch (e) { console.log(e) }
    
  }
}

/**
 * 等待： 等待NAS请求
 */
class Pending extends State {
  constructor(ctx) {
    super(ctx)
  }
}

/**
 * 完成： 获取NAS返回数据
 */
class Finish extends State {
  constructor(ctx, ...args) {
    super(ctx, ...args)
  }

  enter(data) {
    this.ctx.success(data)
  }
}

/**
 * 错误： NAS返回错误或执行出错
 */
class Error extends State {
  constructor(ctx, ...args) {
    super(ctx, ...args)
  }

  enter(error, code) {
    this.ctx.error(error, code)
    this.ctx.ctx.close(this.ctx.jobId)
  }
}

/**
 * 客户端请求
 */
class Server extends EventEmitter {
  constructor(req, res, ctx) {
    super()
    this.req = req
    this.res = res
    this.ctx = ctx
    this.manifest = null
    this.timer = Date.now() + 15*1000
    this.jobId = uuid.v4()
    this.state = null
    this.req.on('error', err => this.error(err))
    this.req.on('close', this.abort)
    
    new Init(this)
  }

  isTimeOut() {
    if (Date.now() > this.timer) {
      let e = new E.PipeResponseTimeout()
      this.error(e)
      return true
    }
    return false
  }

  // 获取res状态
  finished() {
    return this.res.finished
  }

  success(data) {
    if (this.finished()) return
    this.res.success(data)
  }

  error(err, code) {
    if (this.finished()) return
    this.res.error(err, code)
  }

  abort() {
    this.res.finished = true
  }
}

/**
 * server 管理容器
 */
class TransformJson extends EventEmitter {
  constructor(limit) {
    super()
    this.limit = limit || 1024
    this.map = new Map()
  }

  schedule() {
    // timeout todo
    this.map.forEach((value, key) => {
      if (value.finished()) this.map.delete(key)
    })
  }

  close(id) { this.map.delete(id) }

  // 创建客户端请求
  createServer(req, res) {
    console.log(this.map.size)
    this.schedule()
    console.log(this.map.size)
    if (this.map.size > this.limit) throw new E.PipeTooMuchTask()
    new Server(req, res, this)
  }

  // 对客户端请求进行返回
  request(req, res) {
    let { jobId } = req.params
    let server = this.map.get(jobId)
    if (!server) return res.error(new E.TransformJsonQueueNoServer(), 403, false)

    // 超时
    if (server.isTimeOut()) {
      let e = new E.PipeResponseTimeout()
      server.state.setState(Error, e)
      return res.error(e)
    }
    // 重复发送或者客户端撤销请求
    if (server.finished()) {
      let e = new E.PipeResponseHaveFinished()
      server.state.setState(Error, e)
      return res.error(e)
    }

    let responseError = req.body.error
    if (responseError) {
      // 将station错误返回至客户端
      server.state.setState(Error, responseError.message, responseError.code)
    }
    else {
      // 将station数据返回至客户端
      let data = (Object.keys(req.body).length === 1 && req.body.data) ? req.body.data : req.body
      server.state.setState(Finish, data)
    }
    res.end()
  }
}

module.exports = new TransformJson(1024)



