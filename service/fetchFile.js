/*
 * @Author: harry.liu 
 * @Date: 2018-10-10 17:39:00 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2019-01-09 17:13:13
 */

const debug = require('debug')('app:store')
const E = require('../lib/error')
const { State, Init, Err, Server, Container } = require('./base')
const Limit = require('../lib/speedLimit')

/**
 * 状态机
 * server state: init -> notice -> pending -> pipe
 * server state: init -> notice -> pending -> finish
 */

class Pipe extends State {
  constructor(ctx, req, res) {
    super(ctx, req, res)
    this.name = 'pipe'
  }

  enter(req, res) {
    this.ctx.res.on('finish', () => {
      res.success()
    })

    for(let key in req.headers) {
      this.ctx.res.setHeader(key, req.headers[key])
    }

    // let limit = new Limit({readableHighWaterMark: 16000, writableHighWaterMark: 16000})

    req.pipe(this.ctx.res)

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

    if (server.finished()) {
      let e = new E.PipeResponseHaveFinished()
      server.state.setState(Err, e)
      return res.error(e)
    }

    req.on('error', err => {
      console.log('fetchfile in request error', error)
      // response
      res.error(err)
      server.error(err)
    })
    
    server.state.setState(Pipe, req, res)
  }
}

module.exports = new FetchFile(10000)