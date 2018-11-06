/*
 * @Author: harry.liu 
 * @Date: 2018-10-10 16:49:15 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-11-06 12:21:30
 */
const debug = require('debug')('app:store')
const E = require('../lib/error')
const { Init, Finish, Err, Server, Container } = require('./base')

/**
 * 状态机
 * server state: init -> notice -> pending -> finish
 */



/**
 * server 管理容器
 */
class TransformJson extends Container {
  constructor(limit) {
    super(limit)
  }

  // 创建客户端请求
  createServer(req, res) {
    this.schedule()
    debug(this.map.size)
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
      server.state.setState(Err, responseError)
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



