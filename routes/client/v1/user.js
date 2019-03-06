/*
 * @Author: harry.liu 
 * @Date: 2018-09-05 13:25:16 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2019-03-06 17:05:15
 */
const express = require('express')
const router = express.Router()

const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const userService = require('../../../service/userService')
const { weAuth, cAuth } = require('../../../middlewares/jwt')

var timeout = require('connect-timeout')

router.use(timeout('15s'))

/**
 * 手机相关api
 */
// 查询手机号是否注册
router.get('/phone/check', joiValidator({
  query: {
    phone: Joi.string().required()
  }
}), async (req, res) => {
  let { phone } = req.query
  let result = await userService.userPhoneExist(req.db, phone)
  res.success(result)
})

// 发送手机验证码
router.post('/smsCode', joiValidator({
  body: {
    phone: Joi.string().min(11).max(11).required(),
    type: ['register', 'password', 'replace', 'login', 'mail', 'deviceChange']
  }
}), async (req, res) => {
  try {
    let { phone, type } = req.body
    let result = await userService.requestSmsCode(req.db, phone, type)
    res.success(result)
  } catch (e) { console.log(e);res.error(e) }
})

/**
 * 手机验证码换取ticket
 */
router.post('/smsCode/ticket', joiValidator({
  body: {
    phone: Joi.string().required(),
    code: Joi.string().required(),
    type: ['password', 'mail', 'replace', 'register', 'deviceChange', 'deprive']
  }
}), async (req, res) => {
  try {
    let { phone, code, type } = req.body
    let result = await userService.getSmsCodeToken(req.db, phone, code, type)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 使用手机号注册用户
router.post('/', joiValidator({
  body: {
    phone: Joi.string().min(11).max(11).required(),
    ticket: Joi.string().min(36).max(36).required(),
    password: Joi.string().min(6).required(),
    clientId: Joi.string().required(),
    type: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { phone, ticket, password, clientId, type } = req.body
    let result = await userService.signUpWithPhone(req.db, phone, password, ticket, clientId, type)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 使用手机号/密码登录
router.get('/password/token', joiValidator({
  query: {
    username: Joi.string().required(),
    password: Joi.string().min(6).required(),
    clientId: Joi.string().required(),
    type: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { username, password, clientId, type } = req.query
    let result = await userService.getTokenWithPhone(req.db, username, password, clientId, type)
    res.success(result)
  } catch (e) { res.error(e) }
})

router.post('/password/token', joiValidator({
  body: {
    username: Joi.string().required(),
    password: Joi.string().min(6).required(),
    clientId: Joi.string().required(),
    type: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { username, password, clientId, type } = req.body
    let result = await userService.getTokenWithPhone(req.db, username, password, clientId, type)
    res.success(result)
  } catch (e) { res.error(e) }
})

// 使用手机号/验证码登录
router.get('/smsCode/token', joiValidator({
  query: {
    phone: Joi.string().required(),
    code: Joi.string().required(),
    clientId: Joi.string().required(),
    type: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { phone, code, clientId, type } = req.query
    let result = await userService.getTokenWithCode(req.db, phone, code, clientId, type)
    res.success(result)
  } catch (error) { res.error(error) }
})

/**
 * 查询用户信息
 */
router.get('/', cAuth, async (req, res) => {
  try {
    let result = await userService.getUserInfo(req.db, req.auth.id)
    res.success(result)
  } catch (e) { res.error(e) }
})

/**
 * 查询绑定手机号
 */

router.get('/phone', cAuth, async (req, res) => {
  try {
    let { id } = req.auth
    let result = await userService.getPhone(req.db, id)
    res.success(result)
  } catch (e) { res.error(e) }
})

// 换手机号
router.patch('/phone', joiValidator({
  body: {
    oldTicket: Joi.string().required(),
    newTicket: Joi.string().required() 
  }
}), cAuth, async (req, res) => {
  try {
    let { oldTicket, newTicket } = req.body
    let { id } = req.auth
    let result = await userService.replacePhone(req.db, id, oldTicket, newTicket)
    res.success(result)
  } catch (error) { console.log(error);res.error(error)}
})

/**
 * 用户设备使用记录
 */
router.post('/deviceInfo', cAuth, joiValidator({
  body: {
    sn: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { sn } = req.body
    let { id, clientId, type } = req.auth
    await userService.recordDeviceUseInfo(req.db, id, clientId, type, sn)
    res.success()
  } catch (e) { console.log(e); res.error(e) }
})

/**
 * 登录状态下
 * 绑定微信
 */

router.post('/wechat', joiValidator({
  body: {
    code: Joi.string().required(),
    type: Joi.string().required()
  }
}), cAuth, async (req, res) => {
  try {
    let { id, avatarUrl } = req.auth
    let { code, type } = req.body
    let result = await userService.addWechat(req.db, id, code, type, avatarUrl)
    res.success(result)
  } catch (e) {
    res.error(e)
  }
})

/**
 * 解绑微信
 */
router.delete('/wechat', cAuth, joiValidator({
  body: {
    unionid: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { id } = req.auth
    let { unionid } = req.body
    let result = await userService.unbindWechat(req.db, id, unionid)
    res.success(result)
  } catch (error) { res.error(error) }
})

/**
 * 修改密码
 */
router.patch('/password', joiValidator({
  body: {
    password: Joi.string().required(),
    phoneTicket: Joi.string(),
    mailTicket: Joi.string()
  }
}), async (req, res) => {
  try {
    let { password, phoneTicket, mailTicket } = req.body
    let result = await userService.updatePassword(req.db, password, phoneTicket, mailTicket)
    res.success(result)
  } catch (error) { res.error(error) }
})

/**
 * 修改头像
 */
router.put('/avatar', cAuth, async (req, res) => {
  try {
    let { id } = req.auth
    let result = await userService.updateAvatar(req.db, req, id)
    res.success(result)
  } catch (error) { res.error(error) }
})

/**
 * 修改昵称
 */
router.patch('/nickname', cAuth, joiValidator({
  body: {
    nickName: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { id } = req.auth
    let { nickName } = req.body
    let result = await userService.updateNickname(req.db, id, nickName)
    res.success(result)
  } catch (error) { res.error(error) }
})

/**
 * 修改安全级别
 */
router.patch('/safety', cAuth, joiValidator({
  body: {
    safety: [0, 1]
  }
}), async (req, res) => {
  try {
    let { safety } = req.body
    let { id } = req.auth
    let result = await userService.updateSafety(req.db, id, safety)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 查询邮箱号是否存在
router.get('/mail/check', joiValidator({
  query: {
    mail: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { mail } = req.query
    let result = await userService.userMailExist(req.db, mail)
    res.success(result)
  } catch (error) { res.error(error) }
})

/**
 * 发送邮箱验证码: 绑定， 解绑， 修改密码
 */
router.post('/mailCode', joiValidator({
  body: {
    mail: Joi.string().required(),
    type: ['bind', 'unbind', 'password']
  }
}), async (req, res) => {
  try {
    let { mail, type } = req.body
    let result = await userService.createMailCode(req.db, mail, type)
    res.success(result)
  } catch (error) { console.log(error);res.error(error) }
})

/**
 * 绑定邮箱 
 */
router.post('/mail', cAuth, joiValidator({
  body: {
    mail: Joi.string().required(),
    code: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { id } = req.auth
    let { mail, code } = req.body
    let result = await userService.bindMail(req.db, mail, code, id)
    res.success(result)
  } catch (error) { res.error(error)}
})

/**
* 解绑邮箱 
*/
router.delete('/mail', cAuth, joiValidator({
  body: {
    mail: Joi.string().required(),
    code: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { id } = req.auth
    let { mail, code } = req.body
    let result = await userService.unBindMail(req.db, mail, code, id)
    res.success(result)
  } catch (error) { res.error(error) }
})

/**
 * 用户绑定邮箱查询
 */
router.get('/mail', cAuth, async (req, res) => {
  try {
    let { id } = req.auth
    let result = await userService.getUserMail(req.db, id)
    res.success(result)
  } catch (error) { res.error(error) }
})

/**
 * 邮箱验证码换取token
 */
router.post('/mail/ticket', joiValidator({
  body: {
    mail: Joi.string().required(),
    code: Joi.string().required(),
    type: ['password']
  }
}),async (req, res) => {
  try {
    let { mail, code, type } = req.body
    let result = await userService.getMailToken(req.db, mail, code, type)
    res.success(result)
  } catch (error) { res.error(error) }
})

/**
 * 邮箱登录
 */
router.get('/mail/token', joiValidator({
  query: {
    mail: Joi.string().required(),
    password: Joi.string().required(),
    clientId: Joi.string().required(),
    type: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { mail, password, clientId, type } = req.query
    let result = await userService.getTokenWithMail(req.db, mail, password, clientId, type)
    res.success(result)
  } catch(error) { throw error; }
})

console.log(process.env.NODE_ENV)

if (process.env.NODE_ENV == 'test') {
  router.delete('/', joiValidator({
    body: {
      phone: Joi.string().required()
    }
  }), async (req, res) => {
    try {
      let { phone } = req.body
      let sql = `DELETE FROM user WHERE username='${phone}'`
      let result = await req.db.queryAsync(sql)
      res.success(result)
    } catch (error) { res.error(error)}
  })
}

module.exports = router
