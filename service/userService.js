/*
 * @Author: harry.liu 
 * @Date: 2018-09-06 14:51:21 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-11-28 17:19:17
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
const sendSmsCode = require('../lib/sendSmsCode')

const getToken = async (connect, userResult, clientId, type) => {
  // 提取id, password, clientId, type 作为token
  let { id, password, nickName, avatarUrl, safety, username } = userResult[0]
  let user = Object.assign({}, { id, password }, { clientId, type })

  // 邮件
  let mailResult = await User.getMailWithUserId(connect, id)
  let mail
  if (mailResult.length !== 0) mail = mailResult[0].mail

  // 提取用户其他信息
  let obj = { nickName, avatarUrl, safety, id, username, mail }

  return { token: jwt.encode(user), ...obj }
}

class UserService {
  // 判断手机是否注册
  async userPhoneExist(connect, phone) {
    try {
      let userResult = await User.getUserWithPhone(connect, phone)
      if (userResult.length == 1) {
        let { id, avatarUrl, nickName, safety } = userResult[0]
        return { userExist: true, id, avatarUrl, nickName, safety }
      }
      else return { userExist: false }
    } catch (error) { throw error }
  }

  // 判断邮箱是否注册
  async userMailExist(connect, mail) {
    try {
      let userResult = await User.getUserWithMail(connect, mail)
      if (userResult.length == 1) {
        let { id, avatarUrl, nickName, safety } = userResult[0]
        return { userExist: true, id, avatarUrl, nickName, safety }
      }
      else return { userExist: false }
    } catch (error) { throw error }
  }

  /**
   * 使用手机号注册
   */
  async signUpWithPhone(connect, phone, p, code, clientId, type) {
    try {
      // 生产id
      let userId = uuid.v4()

      // 校验验证码
      let smsResult = await User.getSmsCode(connect, phone, code, 'register')

      // 验证码失败
      if (smsResult[2].length == 0) throw new E.SmsCodeError()

      // 检查是否已注册
      let result = await User.getUserByPhone(connect, phone)
      if (result.length !== 0) throw new E.UserAlreadyExist()

      // 注册 ==> 获取用户
      let registerResult = await User.signUpWithPhone(connect, userId, phone, code, p, 'register')
      let userCheck = registerResult[4].affectedRows == 0
      let phoneCheck = registerResult[5].affectedRows == 0
      let codeCheck = registerResult[6].affectedRows == 0
      if (userCheck || phoneCheck || codeCheck) {
        connect.queryAsync('ROLLBACK;')
        throw new Error('register failed')
      }
      connect.queryAsync('COMMIT;')

      let userResult = await User.getUserInfo(connect, userId)

      return await getToken(connect, userResult, clientId, type)

    } catch (error) { console.log(error); throw error }
  }

  // 使用用户名密码登录
  async getTokenWithPhone(connect, u, p, clientId, type) {
    try {

      // 判断用户名密码
      let userResult = await User.loginWithPhone(connect, u, p)
      if (userResult.length !== 1) throw new E.UsernameOrPasswordError()

      // 记录登录信息
      await User.recordLoginInfo(connect, userResult[0].id, clientId, type)

      return await getToken(connect, userResult, clientId, type)

    } catch (error) { throw error }
  }

  // 使用验证码登录
  async getTokenWithCode(connect, phone, code, clientId, type) {
    try {
      // 检查验证码
      let smsResult = await User.getSmsCode(connect, phone, code, 'login')
      // 验证码失败
      if (smsResult[2].length == 0) throw new E.SmsCodeError()

      // 获取用户信息
      let userResult = await User.getUserWithPhone(connect, phone)
      if (userResult.length !== 1) throw new E.UsernameOrPasswordError()

      // 记录登录信息
      await User.recordLoginInfo(connect, userResult[0].id, clientId, type)

      // 更新验证码
      await User.updateSmsCode(connect, phone, code, 'login', 1, 'toConsumed')

      return await getToken(connect, userResult, clientId, type)


    } catch (error) { throw error }
  }

  // 使用邮箱密码登录
  async getTokenWithMail(connect, mail, password, clientId, type) {
    try {
      // 判断
      let userResult = await User.loginWithMail(connect, mail, password)
      if (userResult.length !== 1) throw new E.MailOrPasswordError()
      
      // 记录登录信息
      await User.recordLoginInfo(connect, userResult[0].id, clientId, type)

      return await getToken(connect, userResult, clientId, type)
      
    } catch (error) { throw error }
  }

  // 查询用户信息
  async getUserInfo(connect, userId) {
    try {
      let result = (await User.getUserInfo(connect, userId))[0]
      return Object.assign(result, { password: undefined })
    } catch (error) { throw error }
  }

  async getPhone(connect, id) {
    try {
      let result = await User.getPhone(connect, id)
      return result

    } catch (error) { throw error }
  }

  // ---------------------用户设置---------------------

  // 设备使用记录
  async recordDeviceUseInfo(connect, userId, clientId, type, sn) {
    try {
      // 记录
      await User.recordUseInfo(connect, userId, clientId, type, sn)
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
    } catch (error) { throw error }
  }

  /**
   * 解绑手机
   */
  async unbindPhone(connect, id, phone) {
    try {

    } catch (error) { throw error }
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
      console.log(userInfo)

      let { unionid, nickname, headimgurl, refresh_token, access_token, openid } = userInfo
      // 插入或更新微信用户
      await User.insertIntoWechat(connect, unionid, nickname, headimgurl)
      // 查询微信用户绑定信息
      let wechatUserResult = await User.findWechatAndUserByUnionId(connect, unionid)
      if (wechatUserResult.length !== 1) throw new Error('find wechat user error')
      let { user } = wechatUserResult[0]

      if (user == null) {
        // 微信用户没有绑定注册用户
        let obj = { unionid, access_token, refresh_token, openid }
        return { wechat: jwt.encode(obj), user: false }
      } else {
        // 微信用户绑定了注册用户
        let userResult = await User.getUserInfo(connect, user)

        await User.recordLoginInfo(connect, userResult[0].id, clientId, type)
        return { ...(await getToken(connect, userResult, clientId, type)), user: true }
      }

    } catch (error) { throw error }
  }

  /**
  * 微信账号关联用户
  * 账号存在则关联、不存在则创建
  */
  async wechatAssociateUser(connect, userId, wechat) {
    try {
      if (!wechat) throw new Error('wechat is required')
      // 检查微信账号是否有关联账号
      if (wechat.user !== null) throw new E.WechatAlreadyAssociated()

      // 关联
      let result = await User.addWechat(connect, userId, wechat.unionid)

      return {}

    } catch (error) { throw error }
  }

  // 查询微信
  async getWechatInfo(connect, userId) {
    try {
      return await User.getUserWechat(connect, userId)
    } catch (error) { throw error }
  }

  // 解绑微信
  async unbindWechat(connect, userId, unionid) {
    try {
      let userResult = await User.getUserWechat(connect, userId)
      let result = userResult.find(item => item.unionid == unionid)
      if (!result) throw new Error('unionid error')
      
      await User.unbindWechat(connect, userId, unionid)
      
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

  // 使用ticket设置密码
  async updatePassword(connect, password, phoneTicket, mailTicket) {
    try {
      
      let phoneUser, mailUser
      // 有效性检查
      if (!phoneTicket && !mailTicket ) throw new Error('ticket is required')

      if (phoneTicket) {
        let phoneResult = await User.getSmsCodeTicketInfo(connect, phoneTicket)
        if (phoneResult.length !== 1) throw new E.PhoneTicketInvalid()
        let { phone } = phoneResult[0]
        phoneUser = (await User.getUserWithPhone(connect, phone))[0]
      }

      if (mailTicket) {
        let mailResult = await User.getMailCodeTicketInfo(connect, mailTicket)
        if (mailResult.length !== 1) throw new E.MailTicketInvalid()
        let { mail } = mailResult[0]
        mailUser = (await User.getUserWithMail(connect, mail))[0]
      }

      if (phoneUser && mailUser && phoneUser.id !== mailUser.id) throw new Error('not same user')

      let userId = phoneUser? phoneUser.id: mailUser.id

      let safety = phoneUser? phoneUser.safety: mailUser.safety

      if (safety !== 0 && !(phoneTicket && mailTicket)) throw new Error('double verify')
      
      // 更新密码
      await User.setNewPassword(connect, userId, password)
      // 更新验证码状态 todo
      
    } catch (error) { console.log(error);throw error }
  }

  // 更新安全设置
  async updateSafety(connect, userId, safety) {
    try {
      let mailResult = await User.getUserMail(connect, userId)
      if (safety !== 0 && mailResult.length == 0) throw new E.MailShouldBeBound()
      let updateResult = await User.updateSafeTy(connect, userId, safety)
      return await this.getUserInfo(connect, userId)
      
    } catch (error) { throw error }
  }

  // ---------------------邮件---------------------

  // 邮件验证码
  async createMailCode(connect, mail, type, userId) {
    try {
      let obj = await User.getMail(connect, mail)
      if (type == 'password') {
        if (obj.length == 0) throw new Error('mail not exist')
        if (!obj[0].user) throw new Error('mail has not bind user')
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

  // 换取ticket
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
      
      let result = await User.bindMail(connect, mail, code, userId)
      console.log(result)
      let codeCheck = result[3].affectedRows == 0
      let userCheck = result[4].affectedRows == 0
      if (codeCheck || userCheck) {
        await connect.queryAsync('ROLLBACK;')  
        throw new Error('bind failed')
      }

      await connect.queryAsync('COMMIT;')  

    } catch (error) {
      console.log(error)
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

  // ---------------------短信---------------------

  // 请求短信验证码
  async requestSmsCode(connect, phone, type) {
    try {
      let result = await User.getUserByPhone(connect, phone)
      if (type == 'register') {
        // 检查是否已注册
        if (result.length !== 0) throw new E.UserAlreadyExist()
      }

      // 生成验证码
      let id = uuid.v4()
      let r = (Math.random()).toString()
      let code = r.slice(-4, r.length)
      console.log(code, type)
      await User.createSmsCode(connect, id, phone, code, type)
      
      // 发送验证码
      let res = await sendSmsCode(phone, code, type)
      // // 判断请求是否成功
      if (res.Code !== 'OK') {
        console.log('in res')
        throw new Error(res.Message)
      }

      return { userExist: result.length == 0 ? false : true }

    } catch (error) {
      console.log(error.code)
      let code = error.code
      if (code == 'isv.MOBILE_NUMBER_ILLEGAL') throw new E.MobileError()
      else if (code == 'isv.BUSINESS_LIMIT_CONTROL') throw new E.MobileLimit()
      else throw error
    }
  }

  // 手机ticket
  async getSmsCodeToken(connect, phone, code, type) {
    try {
      // 检查是否已注册
      let u = await User.getUserByPhone(connect, phone)
      if (u.length == 0) throw new E.UserNotExist()

      // 校验验证码
      let codeResult = await User.getSmsCode(connect, phone, code, type)

      let codeRecord = codeResult[2]
      if (codeResult[2].length == 0) throw new E.SmsCodeError()

      await User.updateSmsCode(connect, phone, code, type, 1, 'toConsumed')
      return codeRecord[0].id

    } catch (error) { ; console.log(error); throw error }
  }

}

module.exports = new UserService()
