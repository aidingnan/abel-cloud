/*
 * @Author: harry.liu 
 * @Date: 2018-09-06 14:51:21 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-11-07 17:26:22
 */
const request = require('request')
const promise = require('bluebird')
const uuid = require('uuid')
promise.promisifyAll(request)
const User = require('../models/user')
const E = require('../lib/error')
const jwt = require('../lib/jwt')
const WechatInfo = require('../lib/wechatInfo')

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

      return { token: jwt.encode({ id, clientId, type }) }

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
      let { id } = result[0]
      let user = { id, clientId, type }

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
  async loginWithWechat(connect, code, type) {
    try {
      // 解析code => userinfo
      let wechatInfo = new WechatInfo(type)
      let oth = promise.promisify(wechatInfo.oauth2UserInfo).bind(wechatInfo)
      let userInfo = await oth(null, code)
      let { unionid, nickname, headimgurl, refresh_token, access_token, openid } = userInfo
      // 插入或更新微信用户
      let result = await User.insertIntoWechat(connect, unionid, nickname, headimgurl)
      // 查询微信用户绑定信息
      let wechatUserResult = await User.findWechatAndUserByUnionId(connect, unionid)
      if (wechatUserResult.length !== 1) throw new Error('find wechat user error')
      let { user, id } = wechatUserResult[0]

      if (user == null) {
        // 微信用户没有绑定注册用户
        let obj = { access_token, refresh_token, openid }
        return { token: jwt.encode(obj), user: false }
      } else {
        // 微信用户绑定了注册用户
        return { token: jwt.encode({ id, type: 'wechat' }), user: true }
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

  async updateNickname(connect, userId, nickName) {
    try {
      let result = await User.updateNickName(connect, userId, nickName)
      return result
    } catch (error) { throw error }
  }

}

module.exports = new UserService()

