
class State {
  constructor(ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
  }

  setState(NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args)
  }

  enter() { }

  exit() { }
}

class Syncing extends State {
  constructor(ctx, ...args) {
    super(ctx, ...args)
    this.name = 'syncing'
    console.log('同步token...')
  }
  
  enter() {
    
    this.ctx.ssm.getParameter({ Name: 'tokenKeys' }, (err, data) => {
      if (err) {

      } else {
        let { Value, LastModifiedDate } = data.Parameter
        let nextTime = (new Date(LastModifiedDate)).getTime() + 24 * 3600 * 1000 + 1 * 60 * 1000
        let now = (new Date()).getTime()
        let gap = nextTime - now
        this.ctx.setValue(JSON.parse(Value))
        console.log(`${Math.floor(gap / 1000 / 60)} 分钟后同步数据`)
        this.ctx.timer = setTimeout(() => {
          this.ctx.sync()
        }, gap)
        this.setState(Pending)
      }
    })
  }
}

class Pending extends State {
  constructor(ctx, ...args) {
    super(ctx, ...args)
    this.name = 'pending'
    console.log('等待过期...')
  }
}

class Cache {
  constructor(ssm) {
    this.ssm = ssm
    this.timer = null
    this.state = null
    this.value = null
    new Syncing(this)
  }

  setValue(value) {
    this.value = value
  }

  getValue() {
    return this.value
  }

  sync() {
    new Syncing(this)
  }
}

module.exports = Cache