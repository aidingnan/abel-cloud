/*
 * @Author: harry.liu 
 * @Date: 2018-10-10 16:49:15 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-10-16 17:48:01
 */
const debug = require('debug')('app:store')
const E = require('../lib/error')
const { State, Notice, Finish, Err, Server } = require('./base')

/**
 * 状态机
 * server state: init -> notice -> pending -> finish
 */


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


/**
 * server 管理容器
 */
class TransformJson {
  constructor(limit) {
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
    this.schedule()
    if (this.map.size > this.limit) throw new E.PipeTooMuchTask()
    debug(this.map.size)
    new Server(req, res, this, Init)
  }

  // 对客户端请求进行返回
  request(req, res) {
    let { jobId } = req.params
    let server = this.map.get(jobId)
    // 任务不存在
    if (!server) return res.error(new E.TransformJsonQueueNoServer(), 403, false)

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
    if (responseError) {
      // 将station错误返回至客户端
      server.state.setState(Err, responseError.message, responseError.code)
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



