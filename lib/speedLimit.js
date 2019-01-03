const fs = require('fs')
const path = require('path')
const { Duplex } = require('stream')
const debug = require('debug')('app:store')

// const inputPath = path.normalize('/home/liu/Downloads/(Effective Software Development Series) David Herman-Effective JavaScript_ 68 Specific Ways to Harness the Power of JavaScript-Addison-Wesley Professional (2012).pdf')
// const outPath = path.normalize('/home/liu/Downloads/output')

// const iStream = fs.createReadStream(inputPath)
// const oStream = fs.createWriteStream(outPath)

// console.log(iStream.readableHighWaterMark)
// console.log(oStream.writableHighWaterMark)
// oStream.on('pipe', (src) => console.log('out pipe:'))
// oStream.on('unpipe', (src) => console.log('out unpipe:'))
// oStream.on('finish', () => console.log('out finish:'))
// oStream.on('close', () => console.log('out close'))
// oStream.on('error', error => console.log(error))
// oStream.on('drain', () => console.log('out drain'))

// iStream.on('close', () => console.log('input close'))
// iStream.on('data', () => console.log('in data'))
// iStream.on('end', () => console.log('input end'))
// iStream.on('readable', () => {
//     console.log('in readable', iStream.readableLength)
//     iStream.read()
// })
// iStream.on('error', error => console.log(error))



class Limit extends Duplex {
  constructor(options) {
    super(options)
    this.isend = false
    this.stop = false
    this.eachPart = 0
    this.cb
    this.control = setInterval(() => {
      this.eachPart = 0
      debug(this.stop, !!this.cb)
      if (this.cb && !this.stop) {
        let mid = this.cb
        this.cb = null

        mid(null)
      }
      if (this.isend) {
        clearInterval(this.control)
        this.push(null)
        this.isend = false
      }
    }, 1000)
  }

  _read(size) {
    debug('触发 读取', this.stop ? '暂停了' : '没暂停', !!this.cb ? '有回调' : '没回调')
    if (this.cb && this.stop) {
      debug('暂停有回调-------------')
      let mid = this.cb

      this.cb = null
      this.stop = false

      mid()
    }
  }

  _write(chunk, encoding, callback) {
    debug('触发写入', this.eachPart, chunk.length)
    this.eachPart += chunk.length
    let result = this.push(chunk)

    if (this.eachPart > 365536) {
      debug(' -读取限速')
      this.cb = callback
      return
    }

    if (!result) {
      debug(' -读取缓存已满', this.stop, !!this.cb)
      this.stop = true
      this.cb = callback

    } else {
      debug(' -正常写入')
      callback(null)
    }

  }

  _final(callback) {
    debug('limit _final')
    this.isend = true

    callback()
  }

  _destroy(err, callback) {
    debug('limit _destroy', err)

  }

  inputClose() {
    debug('in clean')
    this.isend = true
  }
}

setTimeout(() => {
  // iStream.destroy()
  // limit.destroy()
}, 2000)
//{readableHighWaterMark: 65536, writableHighWaterMark: 655}
// let limit = new Limit()
// limit.on('close', () => console.log('limit close'))
// limit.on('data', () => console.log('limit data'))
// limit.on('end', () => console.log('limit end'))
// limit.on('readable', () => {
//     console.log('limit readable', limit.readableLength)
// })
// limit.on('error', err => {
//     debug(error, '========================')
// })

// limit.on('drain', () => {
//     console.log('limit drain')
// })

// iStream.pipe(limit).pipe(oStream)

module.exports = Limit


