const chai = require('chai').use(require('chai-as-promised'))
const expect = chai.expect
const request = require('supertest')
const app = require('../../../../bin/www')


describe('abel 测试', () => {

  describe('注册账号', () => {

    it('请求验证码，缺少参数', done => {
      request(app).get('/c/v1/user/smsCode')
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.code).to.deep.equal(400)
          expect(res.body.message).to.deep.equal('invalid parameters')
          done()
        })
    })

    it('请求验证码， 参数错误', done => {
      request(app).get('/c/v1/user/smsCode?phone=13621766832')
        .expect(403)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.code).to.deep.equal(60001)
          done()
        })
    })
  })
  
})