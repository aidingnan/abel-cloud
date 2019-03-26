const EventEmitter = require('events').EventEmitter
const debug = require('debug')('app:store')
const E = require('../lib/error')
const Station = require('../models/station')

class Server {
  constructor(req, res, sn, manifest) {
    this.req = req
    this.res = res
    this.sn = sn
    this.manifest = manifest
    this.timer = Date.now() + 120 * 1000
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
    await publishAsync(obj)
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

  add(req, res, sn, manifest, taskId) {
    try {
      console.log(taskId)
      this.schedule()
      let server = new Server(req, res, sn, manifest)
      this.map.set(taskId, server)
      server.publish()
    } catch(error) { console.log(error) }
  }

  async response(req, res) {
    try {
      let { sn, jobId } = req.params
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
        let { signature } = data
        // let { certId } = req.auth
        // // 通过证书ID获取设备公钥
        // let certResult = await describeCertificateAsync({ certificateId: certId })
        // let { certificatePem, status } = certResult.certificateDescription

        // // 通过公钥验证签名
        // let verify = crypto.createVerify('SHA256').update(encrypted)
        // let verifyResult = verify.verify(certificatePem, signature, 'hex')

        // if (status !== 'ACTIVE') throw new E.StationCertInactive()
        // if (!verifyResult) throw new E.StationVerifyFailed()
        // 标记signature
        await Station.updateSignature(req.db, sn, signature)
        // 删除用户
        let owner = server.req.auth.id
        let { users } = server.manifest
        console.log(owner, sn, users)
        // 

        for(let i = 0; i < users.length; i++) {
          let { id, code, username } = users[i]
          Station.recordShare(req.db, sn, owner, username, id, 'reset', null, code, 'done')
        }
      }

      // 返回station请求
      res.end()
    } catch (error) {
      console.log(error)
      res.error(error)
    }
  }


}

module.exports = new Container()