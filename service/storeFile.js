/*
 * @Author: harry.liu 
 * @Date: 2018-10-11 13:30:14 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-10-16 17:49:08
 */

const debug = require('debug')('app:store')
const E = require('../lib/error')
const { State, Notice, Finish, Err, Server } = require('./base')

const RE_BOUNDARY = /^multipart\/.+?(?: boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i

/**
 * 状态机
 * server state: init -> notice -> pending -> pipe -> pending -> finish
 */

class Init extends State {
  constructor(ctx) {
    super(ctx)
  }

  enter() {
    let server = this.ctx
    let jobId = server.jobId
    let userId = server.req.auth.id
    server.ctx.map.set(jobId, server)
    let m = RE_BOUNDARY.exec(server.req.headers['content-type'])
    if (!m) return 

    let body = server.req.query
    let { method, resource } = body
    delete body.method
    delete body.resource

    this.ctx.manifest = {
      method, resource, body,
      sessionId: jobId,
      user: { id: this.ctx.req.auth.id }
    }

    this.setState(Notice)
  }
}

class Pipe extends State {
  constructor(ctx, res) {
    super(ctx, res)
  }

  enter(res) {
    res.setHeader('content-type', this.ctx.req.headers['content-type'])
    this.ctx.req.pipe(res)
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
    new Server(req, res, this, Init)
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
    // 任务不存在
    if (!server) return res.error(new E.StoreFileQueueNoServer(), 403, false)

    // 重复发送或者客户端撤销请求
    if (server.finished()) {
      let e = new E.PipeResponseHaveFinished()
      server.state.setState(Err, e)
      return res.error(e)
    }

    let { error, data } = req.body
    
    if (error) {
      let { message, code } = error
      server.state.setState(Err, message, code)
    }
    else {
      server.state.setState(Finish, data)
    }
    res.success()
  }
  /**
   * close life cycle of the instance
   * @param {any} jobId 
   * @param {any} err
   * @memberof StoreFile
   */
  close(jobId) {
    if (!this.map.get(jobId)) return
    this.map.delete(jobId)
  }
}

module.exports = new StoreFile(10000)