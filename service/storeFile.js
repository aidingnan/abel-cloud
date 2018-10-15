/*
 * @Author: harry.liu 
 * @Date: 2018-10-11 13:30:14 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-10-15 18:49:26
 */

const EventEmitter = require('events').EventEmitter
const debug = require('debug')('app:store')
const uuid = require('uuid')
const Dicer = require('dicer')
const E = require('../lib/error')

const RE_BOUNDARY = /^multipart\/.+?(?: boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i

const parseHeader = header => {
  let x = Buffer.from(header['content-disposition'][0], 'binary').toString('utf8').replace(/%22/g, '"').split('; ')
  //fix %22
  if (x[0] !== 'form-data') throw new Error('not form-data')
  if (!x[1].startsWith('name="') || !x[1].endsWith('"')) throw new Error('invalid name')
  let name = x[1].slice(6, -1)
  return name
}

/**
 * 状态机基类
 * server state: init -> notice -> pending -> pipe -> pending -> finish
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

class Init extends State {
  constructor(ctx) {
    super(ctx)
  }

  enter() {
    let server = this.ctx
    let jobId = server.jobId
    let userId = server.req.auth.id
    server.ctx.map.set(jobId, server)
    // let m = RE_BOUNDARY.exec(server.req.headers['content-type'])
    // if (!m) return //this.setState(Error)

    let body = server.req.query
    let { method, resource } = body

    this.ctx.manifest = {
      method, resource, body,
      sessionId: jobId,
      user: { id: this.ctx.req.auth.id }
    }

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
      let obj = { topic, qos, payload}
      publishAsync(obj)
      this.setState(Pending)
    } catch (e) { this.setState(Error, e, 500) }
    
  }
}

class Pending extends State {
  constructor(ctx) {
    super(ctx)
  }
}

class Pipe extends State {
  constructor(ctx, res) {
    super(ctx, res)
  }

  enter(res) {
    this.ctx.req.pipe(res)
  }
}

class Finish extends State {
  constructor(ctx, data) {
    super(ctx, data)
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



class Server extends EventEmitter {

  constructor(req, res, ctx) {
    super()
    this.req = req
    this.res = res
    this.ctx = ctx
    this.manifest = null
    this.timer = Date.now() + 150 * 1000
    this.jobId = uuid.v4()
    this.state = null
    req.on('data', () => {})
    new Init(this)
    
    this.req.on('error', err => this.error(err))
    this.req.on('close', this.abort)
  }

  isTimeOut() {
    if (Date.now() > this.timer) {
      let e = new E.PipeResponseTimeout()
      this.error(e)
      return true
    }
    return false
  }

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
 * formidable upload file
 * @class StoreFile
 */
class StoreFile {

  constructor(limit) {
    this.limit = limit || 1024
    this.map = new Map()
    // global handle map
    setInterval(() => {
      if (this.map.size === 0) return
      this.schedule()
    }, 30000)
  }

  // schedule
  schedule() {
    this.map.forEach((v, k) => {
      if (v.finished()) this.map.delete(k)
    })
  }

  request(req, res) {
    let jobId = req.params.jobId
    let server = this.map.get(jobId)
    if (!server) return res.error(new E.StoreFileQueueNoServer(), 403, false)
    // timeout
    if (server.isTimeOut()) {
      let e = new E.PipeResponseTimeout()
      // end
      this.close(jobId)
      return res.error(e)
    }
    if (server.finished()) {
      let e = new E.PipeResponseHaveFinished()
      this.close(jobId)
      return res.error(e)
    }
    // repay
    server.state.setState(Pipe, res)
    // req error
    req.on('error', err => {
      // response
      res.error(err)
      server.error(err)
    })
  }

  createServer(req, res) {
    this.schedule()
    debug('store size: ', this.map.size)
    if (this.map.size > this.limit)
      throw new E.PipeTooMuchTask()
    new Server(req, res, this)
  }
  /**
   * response store error to client
   * @param {any} req 
   * @param {any} res 
   * @memberof StoreFile
   */
  response(req, res) {
    let jobId = req.params.jobId
    let server = this.map.get(jobId)
    if (!server) return res.error(new E.StoreFileQueueNoServer(), 403, false)
    // finished
    if (server.finished()) return res.end()

    let { error, data } = req.body
    // if error exist, server.error()
    if (error) {
      let { message, code } = error
      server.state.setState(Error, message, code)
    }
    else {
      server.state.setState(Finish, data)
    }
    res.success()
    // end
    this.close(jobId)
  }
  /**
   * close life cycle of the instance
   * @param {any} jobId 
   * @param {any} err
   * @memberof StoreFile
   */
  close(jobId) {
    let server = this.map.get(jobId)
    if (!server) return
    // delete map
    this.map.delete(jobId)
  }
}

module.exports = new StoreFile(10000)