const fs = require('fs')
const path = require('path')
const { Duplex } = require('stream')

const inputPath = path.normalize('/home/liu/Downloads/QQ9.0.8_1.exe')
const outPath = path.normalize('/home/liu/Downloads/output')

const iStream = fs.createReadStream(inputPath)
const oStream = fs.createWriteStream(outPath)

console.log(iStream.readableHighWaterMark)
console.log(oStream.writableHighWaterMark)
oStream.on('pipe', (src) => console.log('out pipe:'))
oStream.on('unpipe', (src) => console.log('out unpipe:'))
oStream.on('finish', () => console.log('out finish:'))
oStream.on('close', () => console.log('out close'))
// oStream.on('drain', () => console.log('out drain'))

iStream.on('close', () => console.log('input close'))
// iStream.on('data', () => console.log('in data'))
iStream.on('end', () => console.log('input end'))
// iStream.on('readable', () => {
//     console.log('in readable', iStream.readableLength)
//     iStream.read()
// })



class Limit extends Duplex {
    constructor(options) {
        super(options)
        this.isend = false
        this.eachPart = 0
        this.cb
        this.control = setInterval(() => {
            this.eachPart = 0
            if (this.cb) {
                this.cb(null)
                this.cb = null
            } 
            if (this.isend) this.push(null)
        }, 1000)
    }

    _read(size) {
        // console.log('in read', size)
        // let result = this.push(this.data)
        // console.log(result)
    }

    _write(chunk, encoding, callback) {
        console.log('limit _write', this.eachPart)
        if ( this.eachPart < 655360) {
            this.eachPart += chunk.length
            let result = this.push(chunk)
            console.log(result)
            callback(null)
        } else {
            let result = this.push(chunk)
            console.log(result)
            this.cb = callback
        }
    }

    _final(callback) {
        console.log('limit _final')
        this.isend = true
        callback()
        
    }
}

let limit = new Limit({readableHighWaterMark: 65536, writableHighWaterMark: 655})
limit.on('close', () => console.log('limit close'))
limit.on('data', () => console.log('limit data'))
limit.on('end', () => console.log('limit end'))
// limit.on('readable', () => {
//     console.log('limit readable', limit.readableLength)
// })

// limit.on('drain', () => {
//     console.log('limit drain')
// })

// iStream.pipe(limit).pipe(oStream)

module.exports = Limit


