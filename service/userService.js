/*
 * @Author: harry.liu 
 * @Date: 2018-09-06 14:51:21 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-09-07 18:45:56
 */
const request = require('request')
const promise = require('bluebird')
const uuid = require('uuid')
promise.promisifyAll(request)
const User = require('../models/user')
const E = require('../lib/error')
const jwt = require('../lib/jwt')

class UserService {
  async requestSmsCode(connect, phone) {
    try {
      // 检查是否已注册
      let result = await User.getUserByPhone(connect, phone)
      if (result.length !== 0) throw new E.UserAlreadyExist()
      // 请求验证码
      let res = await request.postAsync({
        uri: 'https://abel.leanapp.cn/v1/user/requestSmsCode',
        json: true,
        body: {phone}
      })
      
      // 判断请求是否成功
      if (res.statusCode !== 200) throw new E.InvalidPhoneNumber()

    } catch (error) { throw error }
  }

  async signUpWithPhone(connect, phone, password, code) {
    try {
      // 生产id
      let id = uuid.v4()
      // 检查是否已注册
      let result = await User.getUserByPhone(connect, phone)
      if (result.length !== 0) throw new E.UserAlreadyExist()
      // 校验验证码
      let res = await request.postAsync({
        uri: 'https://abel.leanapp.cn/v1/user/verifySmsCode',
        json: true,
        body: { phone, code}
      })
      if (res.statusCode !== 200) throw new E.SmsCodeError()
      
      // 插入用户/手机数据
      await User.signUpWithPhone(connect, id, phone, password)

      return { token: jwt.encode({id, phone})}
      return 
    } catch (error) {  throw error }
  }

  async token(connect, username, password) {
    try {
      
      // 判断username类型(手机/邮箱) todo 
      // 使用邮箱登录 todo
      // 使用手机号登录
      let user = await User.loginWithPhone(connect, username, password)
      return { token: jwt.encode(user)}
      console.log(user)

    } catch (error) { throw error }
  }


}

module.exports = new UserService()

