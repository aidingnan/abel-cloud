const EventEmitter = require('events').EventEmitter
const uuid = require('uuid')
const debug = require('debug')('app:store')
const E = require('../lib/error')


class State {
  constructor(ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    debug(`${this.ctx.jobId} enter state : ${this.constructor.name}`)
    this.enter(...args)
  }

  setState(NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args)
  }

  enter() { }

  exit() { }
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

    let body = server.req.body
    let SetCookie = this.ctx.req.headers['cookie']
    this.ctx.manifest = Object.assign({
      sessionId: jobId,
      user: { id: this.ctx.req.auth.id },
      headers: { 'cookie': SetCookie },
      requestType: this.ctx.ctx.requestType
    }, body)

    this.setState(Notice)
  }
}

class Notice extends State {
  constructor(ctx) {
    super(ctx)
  }

  async enter() {
    try {
      let sn = this.ctx.req.params.sn
      let topic = `cloud/${sn}/pipe`
      let qos = 1
      let payload = JSON.stringify(this.ctx.manifest)
      let obj = { topic, qos, payload }
      publishAsync(obj)
      this.setState(Pending)
    } catch (e) { this.setState(Error, e, 500) }

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
class Err extends State {
  constructor(ctx, ...args) {
    super(ctx, ...args)
  }

  enter(error, code) {
    this.ctx.error(error, code)
  }
}

/**
 * Server
 */

class Server extends EventEmitter {

  constructor(req, res, ctx, Init) {
    super()
    this.req = req
    this.res = res
    this.ctx = ctx
    this.manifest = null
    this.timer = Date.now() + 150 * 1000
    this.jobId = uuid.v4()
    this.state = null
    new Init(this)
    this.req.on('error', err => this.error(err))
    this.req.on('close', this.abort)
  }

  isTimeOut() {
    if (Date.now() > this.timer) return true
    else return false
  }

  finished() {
    return this.res.finished
  }

  success(data) {
    if (this.finished()) return
    this.res.success(data)
  }

  error(err, code) {
    console.log('in error', err)
    if (this.finished()) return
    this.res.error(err, code)
  }

  abort() {
    // console.log('in abort')
    this.res.finished = true
    try {
      req.db.release()
    } catch (e) { }
    // this.res.error()
  }
}

global.queue = global.queue?global.queue: new Map()

class Container {
  constructor(limit) {
    this.limit = limit || 1024
    this.map = global.queue
  }

  schedule() {
    this.map.forEach((v, k) => {
      if (v.finished()) this.map.delete(k)
    })
  }

  // 对客户端请求进行返回
  response(req, res) {
    let { jobId } = req.params
    let server = this.map.get(jobId)
    // 任务不存在
    if (!server) {
      console.log('task not exist')
      return res.error(new E.TransformJsonQueueNoServer(), 403, false)
    }

    // 超时
    if (server.isTimeOut()) {
      let e = new E.PipeResponseTimeout()
      server.state.setState(Err, e)
      return res.error(e)
    }
    // 重复发送或者客户端撤销请求
    if (server.finished()) {
      let e = new E.PipeResponseHaveFinished()
      server.state.setState(Err, e)
      return res.error(e)
    }

    let responseError = req.body.error
    if (responseError) console.log('response error', req.body.error)
    if (responseError) {
      // 将station错误返回至客户端
      server.state.setState(Err, responseError)
    }
    else {
      // 将station数据返回至客户端
      let data = (Object.keys(req.body).length === 1 && req.body.data) ? req.body.data : req.body
      server.state.setState(Finish, data)
    }
    res.success()
  }
}

module.exports = { State, Pending, Notice, Finish, Err, Server, Container, Init }