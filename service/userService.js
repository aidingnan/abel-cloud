/*
 * @Author: harry.liu 
 * @Date: 2018-09-06 14:51:21 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-11-13 18:31:25
 */
const request = require('request')
const promise = require('bluebird')
const uuid = require('uuid')
promise.promisifyAll(request)
const User = require('../models/user')
const E = require('../lib/error')
const jwt = require('../lib/jwt')
const WechatInfo = require('../lib/wechatInfo')
const sendMail = require('../lib/sendMail')


class UserService {
  /**
   * 请求验证码
   * 1. 请求头不带wechat,使用手机号注册
   * 2. 请求头带wechat, 将
   */
  async requestSmsCode(connect, phone, wechat) {
    try {
      // 检查微信是否已关联
      if (wechat && wechat.user !== null) throw new E.WechatAlreadyAssociated()
      // 检查是否已注册
      let result = await User.getUserByPhone(connect, phone)
      if (result.length !== 0 && !wechat) throw new E.UserAlreadyExist()
      // 请求验证码
      let res = await request.postAsync({
        uri: 'https://abel.leanapp.cn/v1/user/requestSmsCode',
        json: true,
        body: { phone }
      })
      // // 判断请求是否成功
      if (res.statusCode !== 200) throw new Error(res.body)

      return { userExist: result.length == 0 ? false : true }

    } catch (error) { throw error }
  }

  /**
   * 使用手机号注册
   */
  async signUpWithPhone(connect, phone, password, code, safety, clientId, type) {
    try {
      // 生产id
      let id = uuid.v4()

      // 校验验证码
      let res = await request.postAsync({
        uri: 'https://abel.leanapp.cn/v1/user/verifySmsCode',
        json: true,
        body: { phone, code }
      })

      // 验证码失败 ==> 错误
      if (res.statusCode !== 200) throw new E.SmsCodeError()
      // 检查是否已注册
      let result = await User.getUserByPhone(connect, phone)
      // 用户不存在 ==> 注册 ==> 获取用户
      safety = safety || 1
      if (result.length == 0) await User.signUpWithPhone(connect, id, phone, password, safety)
      else throw new E.UserAlreadyExist()

      return { token: jwt.encode({ id, password, clientId, type }) }

    } catch (error) { throw error }
  }

  /**
   * 常规登录
   */
  async token(connect, u, p, clientId, type) {
    try {

      // 判断username类型(手机/邮箱) todo

      // 使用邮箱登录 todo

      // 使用手机号登录
      let result = await User.loginWithPhone(connect, u, p)
      if (result.length !== 1) throw new E.UserNotExist()
      let { id, password } = result[0]
      let user = { id, clientId, type, password }

      // 记录登录信息
      await User.recordLoginInfo(connect, id, clientId, type)

      let obj = Object.assign((await User.getUserInfo(connect, id))[0], {password: undefined})

      return { token: jwt.encode(user), ...obj }

    } catch (error) { throw error }
  }

  async getUserInfo(connect, userId) {
    try {
      let result = (await User.getUserInfo(connect, userId))[0]
      return Object.assign(result, { password: undefined})
    } catch (error) { throw error}
  }

  /**
   * 设备使用记录
   */
  async recordDeviceUseInfo (connect, userId, clientId, type, sn) {
    try {
      // 记录
      await User.recordUseInfo(connect, userId, clientId, type, sn)
    } catch (error) { throw error }
  }

  async getPhone(connect, id) {
    try {
      let result = await User.getPhone(connect, id)
      console.log(result)
      return result

    } catch (error) { throw error }
  }

  /**
   * 添加手机
   */
  async bindPhone(connect, id, phone, code) {
    try {
      // 校验验证码
      let res = await request.postAsync({
        uri: 'https://abel.leanapp.cn/v1/user/verifySmsCode',
        json: true,
        body: { phone, code }
      })

      // 验证码失败 ==> 错误
      if (res.statusCode !== 200) throw new E.SmsCodeError()
      
      let result = await User.addPhone(connect, id, phone)
      console.log(result)
    } catch (error) { throw error }
  }

  /**
   * 解绑手机
   */
  async unbindPhone(connect, id, phone) {
    try {
      
    } catch (error) { throw error}
  }


  /**
   * 添加微信账号
   */
  async addWechat(connect, id, code, type) {
    try {
      // 解析code => userinfo
      let wechatInfo = new WechatInfo(type)
      let oth = promise.promisify(wechatInfo.oauth2UserInfo).bind(wechatInfo)
      let userInfo = await oth(null, code)
      let { unionid, nickname, headimgurl } = userInfo
      // 插入或更新微信用户
      await User.insertIntoWechat(connect, unionid, nickname, headimgurl)
      // 查询微信用户绑定信息
      let wechatUserResult = await User.findWechatAndUserByUnionId(connect, unionid)
      if (wechatUserResult.length !== 1) throw new Error('find wechat failed')
      if (wechatUserResult[0].user !== null) throw new Error('wechat has been bound')

      // 添加绑定
      let result = await User.addWechat(connect, id, unionid)
      return result
    } catch (error) { throw error }
  }

  /**
   * 微信登录
   */
  async loginWithWechat(connect, code, loginType, clientId, type) {
    try {
      // 解析code => userinfo
      let wechatInfo = new WechatInfo(loginType)
      let oth = promise.promisify(wechatInfo.oauth2UserInfo).bind(wechatInfo)
      let userInfo = await oth(null, code)
      let { unionid, nickname, headimgurl, refresh_token, access_token, openid } = userInfo
      // 插入或更新微信用户
      let result = await User.insertIntoWechat(connect, unionid, nickname, headimgurl)
      // 查询微信用户绑定信息
      let wechatUserResult = await User.findWechatAndUserByUnionId(connect, unionid)
      if (wechatUserResult.length !== 1) throw new Error('find wechat user error')
      let { user, id, password } = wechatUserResult[0]

      if (user == null) {
        // 微信用户没有绑定注册用户
        let obj = { access_token, refresh_token, openid }
        return { token: jwt.encode(obj), user: false }
      } else {
        // 微信用户绑定了注册用户
        return { token: jwt.encode({ id, password, clientId, type }), user: true }
      }

    } catch (error) { throw error }
  }

  /**
   * 微信账号关联用户
   * 账号存在则关联、不存在则创建
   */
  async wechatAssociateUser(req, phone, code, password) {
    try {
      let user, id
      let { wechat, db } = req
      let { unionid } = wechat
      let users = await User.getUserByPhone(db, phone)
      if (!wechat) throw new Error('wechat is required')
      // 检查微信账号是否有关联账号
      if (wechat.user !== null) throw new E.WechatAlreadyAssociated()
      // 检查password参数是否正确
      if (users.length == 0 && !password) throw new Error('password is required')
      if (users.length == 1 && password) throw new Error('password is not required')
      // 校验验证码
      let res = await request.postAsync({
        uri: 'https://abel.leanapp.cn/v1/user/verifySmsCode',
        json: true,
        body: { phone, code }
      })

      // 验证码失败 ==> 错误
      if (res.statusCode !== 200) throw new E.SmsCodeError()

      // 用户不存在 => 注册
      // 用户存在 => do nothing
      if (users.length == 0) {
        id = uuid.v4()
        let newUser = await User.signUpWithPhone(db, id, phone, password)
      } else {
        id = users[0].user
      }
      // 关联
      let result = await User.addWechat(db, id, unionid)


      // console.log('result')
      console.log(result)


    } catch (error) { throw error }
  }

  // 更新头像
  async updateAvatar(connect, req, userId) {
    try {
      let id = uuid.v4()

      let result = await uploadAsync({
        Bucket: 'wisnuc', Key: `avatar/${id}`, Body: req, ACL: 'public-read'
      })

      let { Location } = result

      await User.updateAvatar(connect, userId, Location)
      
      return Location
    } catch (error) { throw error }
  }

  // 更新昵称
  async updateNickname(connect, userId, nickName) {
    try {
      let result = await User.updateNickName(connect, userId, nickName)
      return result
    } catch (error) { throw error }
  }

  // 修改密码token
  async getPasswordToken(connect, phone, code) {
    try {
      // 检查是否已注册
      let u = await User.getUserByPhone(connect, phone)
      if (u.length == 0) throw new E.UserNotExist()

      // 校验验证码
      let res = await request.postAsync({
        uri: 'https://abel.leanapp.cn/v1/user/verifySmsCode',
        json: true,
        body: { phone, code }
      })

      // 验证码失败 ==> 错误
      if (res.statusCode !== 200) throw new E.SmsCodeError()
      
      let id = uuid.v4()
      await User.addPasswordCodeRecord(connect, id, phone, code, 'password', 'toConsumed')
      return id
      
    } catch (error) { throw error }
  }

  // 使用token设置密码
  async updatePasswordWithToken(connect, token, phone, password) {
    try {
      // 检验token
      let record = await User.getSmsCodeUserRecord(connect, token, phone)
      if (record.length == 0) throw new Error('token error')
      if (record[0].status == 'consumed') throw new Error('token has been consumed')
      // 获取user
      let userResult = await User.getUserWithPhone(connect, phone)
      if (userResult.length == 0 || !userResult[0].id) throw new Error('user not exist')
      let userId = userResult[0].id
      // 更新密码
      await User.setNewPassword(connect, userId, password)
      // 更新验证码状态
      let r = await User.updateSmsRecordStatus(connect, token, phone, 'consumed')
    } catch (error) { throw error }
  }

  // 邮件验证码
  async createMailCode(connect, mail, type, userId) {
    try {
      let obj = await User.getMail(connect, mail)
      if (type == 'password') {
        // if (obj.length == 0) throw new Error('mail not exist')
        // if (!obj[1].user) throw new Error('mail has not bind user')
      }

      if (type == 'bind') {
        // 查询邮箱是否已被绑定
        let mailResult = await User.getMail(connect, mail)
        if (mailResult.length !== 0) throw new E.MailAlreadyBound()  
      }

      let id = uuid.v4()
      let r = (Math.random()).toString()
      let code = r.slice(-4, r.length)
      console.log(code)

      await sendMail(mail, code)
    
      let result = await User.createMailCode(connect, id, mail, code, type)
      return result
    } catch (error) { throw error }
  }

  // 换取token
  async getMailToken(connect, mail, code, type) {
    try {
      let codeResult = await User.getMailCode(connect, mail, code, type)
      let codeRecord = codeResult[2]
      if (codeResult[2].length == 0) throw new E.MailCodeInvalid()

      await User.getMailToken(connect, mail, code, type, 1, 'toConsumed')

      return codeRecord[0].id
    } catch (error) { throw error }
  }

  // 绑定邮箱
  async bindMail(connect, mail, code, userId) {
    try {
      // 查询用户是否已绑定邮箱
      let userMail = await User.getUserMail(connect, userId)
      if (userMail.length > 0) throw new E.UserHasBoundMail()
      // 查询邮箱是否已被绑定
      let mailResult = await User.getMail(connect, mail)
      if (mailResult.length !== 0) throw new E.MailAlreadyBound()
      // 检查验证码
      let codeResult = await User.getMailCode(connect, mail, code, 'bind')
      if (codeResult[2].length == 0) throw new E.MailCodeInvalid()
      // 绑定
      await User.bindMail(connect, mail, code, userId)
    } catch (error) {
        if (error.errno == 1062) throw new E.MailAlreadyBound()
        else throw error
     }
  }

  // 解绑邮箱
  async unBindMail(connect, mail, code, userId) {
    try {
      // 检查邮箱是否属于用户
      let userMail = await User.getUserMail(connect, userId)
      let mailInList = userMail.findIndex(item => item.mail == mail)
      if (mailInList == -1) throw new Error('mail is not belong to user')
      // 检查验证码
      let codeResult = await User.getMailCode(connect, mail, code, 'unbind')
      if (codeResult[2].length == 0) throw new E.MailCodeInvalid()
      // 解绑
      await User.unBindMail(connect, mail, code, userId)
    } catch (error) { throw error }
  }

  // 查询绑定邮箱
  async getUserMail(connect, userId) {
    try {
      let result = await User.getUserMail(connect, userId)
      return result
    } catch (error) { throw error }
  }

}

module.exports = new UserService()
