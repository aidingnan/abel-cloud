/*
 * @Author: harry.liu 
 * @Date: 2018-10-11 13:30:14 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2019-01-03 11:50:23
 */

const debug = require('debug')('app:store')
const E = require('../lib/error')
const { State, Init, Err, Server, Container } = require('./base')

/**
 * 状态机
 * server state: init -> notice -> pending -> pipe -> pending -> finish
 */

class Pipe extends State {
  constructor(ctx, res) {
    super(ctx, res)
    this.name = 'pipe'
  }

  enter(res) {
    for(let key in this.ctx.req.headers) {
      res.setHeader(key, this.ctx.req.headers[key])
    }
    
    res.once('close', () => {
      console.log('data now is ', Date.now())
      console.log('res close ', this.ctx.timer)
      this.ctx.timer = Date.now() + 30 * 1000
      console.log('reset timer ', this.ctx.timer)
    })

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
    this.requestType = 'store'
  }

  schedule() {
    this.map.forEach((v, k) => {
      if (v.finished()) this.map.delete(k)
    })
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
}

module.exports = new StoreFile(10000)