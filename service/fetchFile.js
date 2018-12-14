/*
 * @Author: harry.liu 
 * @Date: 2018-10-10 17:39:00 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-12-14 16:23:54
 */

const debug = require('debug')('app:store')
const E = require('../lib/error')
const { State, Notice, Finish, Err, Server, Container } = require('./base')
const Limit = require('../lib/speedLimit')

/**
 * 状态机
 * server state: init -> notice -> pending -> pipe
 * server state: init -> notice -> pending -> finish
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
    try {
      var body = JSON.parse(server.req.query.data)
      let range = this.ctx.req.headers['range']
      let SetCookie = this.ctx.req.headers['cookie']

      this.ctx.manifest = Object.assign({
        sessionId: jobId,
        user: { id: this.ctx.req.auth.id },
        headers: { range, 'cookie': SetCookie }
      }, body)

      this.setState(Notice)
    } catch (e) { this.setState(Err, e) }
    
  }
}

class Pipe extends State {
  constructor(ctx, req, res) {
    super(ctx, req, res)
  }

  enter(req, res) {
    this.ctx.res.on('finish', () => {
      res.success()
    })

    for(let key in req.headers) {
      this.ctx.res.setHeader(key, req.headers[key])
    }

    let limit = new Limit()

    req.pipe(this.ctx.res)

    // req.pipe(limit).pipe(this.ctx.res)

    // req.on('error')
  }
}

class FetchFile extends Container {
  constructor(limit) {
    super(limit)
    this.requestType = 'fetch'
  }

  createServer(req, res) {
    this.schedule()
    if (this.map.size > this.limit) throw new E.PipeTooMuchTask()
    debug(this.map.size)
    new Server(req, res, this, Init)
  }

  request(req, res) {
    let jobId = req.params.jobId
    let server = this.map.get(jobId)
    if (!server) return res.error(new E.StoreFileQueueNoServer(), 403, false)

    // timeout
    if (server.isTimeOut()) {
      let e = new E.PipeResponseTimeout()
      server.state.setState(Err, e)
      return res.error(e)
    }
    if (server.finished()) {
      let e = new E.PipeResponseHaveFinished()
      server.state.setState(Err, e)
      return res.error(e)
    }

    
    server.state.setState(Pipe, req, res)

    req.on('error', err => {
      console.log('in request error', error)
      // response
      res.error(err)
      server.error(err)
    })
  }

}

module.exports = new FetchFile(10000)