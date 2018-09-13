/*
 * @Author: harry.liu 
 * @Date: 2018-09-06 14:51:21 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-09-13 18:23:31
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
   */
  async requestSmsCode(connect, phone) {
    try {
      // 检查是否已注册
      let result = await User.getUserByPhone(connect, phone)
      if (result.length !== 0) throw new E.UserAlreadyExist()
      // 请求验证码
      let res = await request.postAsync({
        uri: 'https://abel.leanapp.cn/v1/user/requestSmsCode',
        json: true,
        body: { phone }
      })
      
      // 判断请求是否成功
      if (res.statusCode !== 200) throw new E.InvalidPhoneNumber()

    } catch (error) { throw error }
  }

  /**
   * 使用手机号注册
   */
  async signUpWithPhone(connect, phone, password, code, wechat) {
    try {
      // 生产id
      let id = uuid.v4()
      let user

      // 检验微信token 
      if (wechat) {
        console.log(wechat)
      }

      return

      // 检验微信号是否已有绑定

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
      // 用户已注册 && 没有绑定微信参数 ==> 错误
      if (result.length !== 0 && !refresh_token) throw new E.UserAlreadyExist()
      // 用户已注册 && 存在绑定微信参数 ==> 获取用户
      if (result.length == 1 && refresh_token) user = result[0]
      // 用户不存在 ==> 注册 ==> 获取用户
      if (result.length == 0) user = await User.signUpWithPhone(connect, id, phone, password)

      
      
      

      
      

      return { token: jwt.encode({ id, type: 'phone'})}
    } catch (error) {  throw error }
  }

  /**
   * 常规登录
   */
  async token(connect, u, p) {
    try {
      
      // 判断username类型(手机/邮箱) todo
      
      // 使用邮箱登录 todo

      // 使用手机号登录
      let result = await User.loginWithPhone(connect, u, p)
      if (result.length !== 1) throw new E.UserNotExist()
      let { id } = result[0]
      let user = { id, type: 'phone' }

      return { token: jwt.encode(user)}
      

    } catch (error) { throw error }
  }

  async findUserById(id) {
    try {
      let user = await User.getUserById(id)
      return user
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
    } catch (error) { throw error}
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

      if ( user == null) {
        // 微信用户没有绑定注册用户
        let obj = { access_token, refresh_token, openid }
        return { wechatToken: jwt.encode(obj) }
      } else {
        // 微信用户绑定了注册用户
        return { token: jwt.encode({ id, type: 'wechat'})}
      }
      
    } catch (error) { throw error }
  }
}



module.exports = new UserService()

