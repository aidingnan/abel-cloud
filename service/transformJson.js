// cloud/:sn/pipe
// 1

const EventEmitter = require('events').EventEmitter
const uuid = require('uuid')
const E = require('../lib/error')


// server state: init -> notice -> pending -> finish
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
    this.name = 'init'
  }

  enter() {
    let server = this.ctx
    let id = this.ctx.jobId
    this.ctx.ctx.map.set(id, server)
    let body
    if (server.req.method == 'GET') body = server.req.query
    else if (server.req.method == 'POST') body = server.req.body
    let { method, resource } = body

    this.ctx.manifest = {
      method, resource, body,
      sessionId: id,
      user: { id: this.ctx.req.auth.id }
    }

    this.setState(Notice)
  }
}

class Notice extends State {
  constructor(ctx) {
    super(ctx)
    this.name = 'notice'
  }

  async enter(...args) {
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

class Pending extends State {
  constructor(ctx) {
    super(ctx)
  }
}

class Finish extends State {
  constructor(ctx, ...args) {
    super(ctx, ...args)
  }

  enter(data) {
    this.ctx.success(data)
  }
}

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
    this.timer = Date.now() + 150*1000
    this.jobId = uuid.v4()
    this.state = null
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

class TransformJson extends EventEmitter {
  constructor(limit) {
    super()
    this.limit = limit || 1024
    this.map = new Map()
  }

  schedule() {
    this.map.forEach((value, key) => {
      if (value.finished()) this.map.delete(key)
    })
  }

  close(id) {
    this.map.delete(id)
  }

  createServer(req, res) {
    this.schedule()
    if (this.map.size > this.limit) throw new E.PipeTooMuchTask()
    let server = new Server(req, res, this)
  }

  request(req, res) {
    let { jobId } = req.params
    let server = this.map.get(jobId)
    if (!server) return res.error(new E.TransformJsonQueueNoServer(), 403, false)

    if (server.isTimeOut()) {
      let e = new E.PipeResponseTimeout()
      server.state.setState(Error, e)
      return res.error(e)
    }
    if (server.finished()) {
      let e = new E.PipeResponseHaveFinished()
      server.state.setState(Error, e)
      return res.error(e)
    }

    // client response 
    let responseError = req.body.error
    if (responseError) {
      server.state.setState(Error, responseError.message, responseError.code)
    }
    else {
      // backwards compatible
      let data = (Object.keys(req.body).length === 1 && req.body.data) ? req.body.data : req.body
      server.state.setState(Finish, data)
    }
    res.end()
  }
}

module.exports = new TransformJson(1024)



