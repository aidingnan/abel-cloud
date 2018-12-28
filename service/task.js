const EventEmitter = require('events').EventEmitter
const debug = require('debug')('app:store')
const E = require('../lib/error')

class Server {
  constructor(res, sn, manifest) {
    this.res = res
    this.sn = sn
    this.manifest = manifest
    this.timer = Date.now() + 120 * 1000
    this.req.on('close', this.abort)
  }

  isTimeOut() {
    if (Date.now() > this.timer) return true
    else return false
  }

  async publish() {
    let topic = `cloud/${this.sn}/reset`
    let qos = 1
    let payload = JSON.stringify(this.manifest)
    let obj = { topic, qos, payload }
    let r = await publishAsync(obj)
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
    // this.res.error()
  }
}

class Container {
  constructor() {
    this.map = new Map()
  }

  schedule() {
    console.log(this.map.size)
    this.map.forEach((v, k) => {
      if (v.finished()) this.map.delete(k)
    })
  }

  add(res, sn, manifest, taskId) {
    try {
      this.schedule()
      let server = new Server(res, sn, manifest)
      this.map.set(taskId, server)
      server.publish()
    } catch(error) { console.log(error) }
  }

  response(req, res) {
    let { jobId } = req.params
    let server = this.map.get(jobId)

    // 找任务
    if (!server) {
      return res.error(new E.TransformJsonQueueNoServer(), 403, false)
    }
    // 超时
    if (server.isTimeOut()) {
      let e = new E.PipeResponseTimeout()
      server.error(e)
      return res.error(e)
    }
    // 重复发送或者客户端撤销请求
    if (server.finished()) {
      let e = new E.PipeResponseHaveFinished()
      server.error(e)
      return res.error(e)
    }

    let responseError = req.body.error
    if (responseError) console.log('response error', req.body.error)
    if (responseError) {
      // 将station错误返回至客户端
      server.error(responseError)
    }
    else {
      // 恢复出厂设置
      let data = (Object.keys(req.body).length === 1 && req.body.data) ? req.body.data : req.body
      server.state.setState(Finish, data)
    }

    // 返回station请求
    res.end()
  }


}

module.exports = new Container()