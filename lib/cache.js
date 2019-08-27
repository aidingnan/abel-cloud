
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
        this.setState(Err, new Error('test'))
      } else {
        let { Value, LastModifiedDate } = data.Parameter
        let nextTime = (new Date(LastModifiedDate)).getTime() + 2 * 3600 * 1000 + 0.2 * 60 * 1000
        let now = (new Date()).getTime()
        let gap = nextTime - now
        this.ctx.setValue(JSON.parse(Value))
        console.log(`${Math.floor(gap / 1000 )} 秒后再次同步数据`)
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

class Err extends State {
  enter(err) {
    let second = 10
    console.log(`错误 -> ${second} 后重新尝试同步token`)
    setTimeout(() => {
      this.setState(Syncing)
    }, second * 1000)
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