/*
 * @Author: harry.liu 
 * @Date: 2018-10-11 13:30:14 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-10-17 16:57:00
 */

const debug = require('debug')('app:store')
const E = require('../lib/error')
const { State, Init, Finish, Err, Server, Container } = require('./base')

/**
 * 状态机
 * server state: init -> notice -> pending -> pipe -> pending -> finish
 */

class Pipe extends State {
  constructor(ctx, res) {
    super(ctx, res)
  }

  enter(res) {
    console.log(this.ctx.req.headers['content-type'])
    res.setHeader('content-type', this.ctx.req.headers['content-type'])
    this.ctx.req.pipe(res)
  }
}


/**
 * formidable upload file
 * @class StoreFile
 */
class StoreFile extends Container {

  constructor(limit) {
    super(limit)
  }

  createServer(req, res) {
    this.schedule()
    debug('store size: ', this.map.size)
    if (this.map.size > this.limit)
      throw new E.PipeTooMuchTask()
    new Server(req, res, this, Init)
  }

  request(req, res) {
    try {
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
      
      server.state.setState(Pipe, res)
      // req error
      req.on('error', err => {
        // response
        res.error(err)
        server.error(err)
      })
    } catch (e) {
      console.log(e, 'in catch')
      res.error(e)
    }
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
}

module.exports = new StoreFile(10000)