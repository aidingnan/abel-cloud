/*
 * @Author: harry.liu 
 * @Date: 2018-09-05 13:25:16 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-11-13 16:58:37
 */
const express = require('express')
const router = express.Router()

const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const userService = require('../../../service/userService')
const { weAuth, cAuth } = require('../../../middlewares/jwt')
const nodemailer = require('nodemailer');

/**
 * 1. 注册新用户
 * 2. 微信关联账号
 */

router.get('/smsCode', weAuth(), joiValidator({
  query: {
    phone: Joi.string().min(11).max(11).required()
  }
}), async (req, res) => {
  try {
    let { phone } = req.query
    let result = await userService.requestSmsCode(req.db, phone, req.wechat)
    res.success(result)
  } catch (e) { console.log(e); res.error(e) }
})

// 使用手机号注册用户
router.post('/', joiValidator({
  body: {
    phone: Joi.string().min(11).max(11).required(),
    code: Joi.string().min(6).max(6).required(),
    password: Joi.string().min(6).required(),
    clientId: Joi.string().required(),
    type: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { phone, code, password, safety } = req.body
    let result = await userService.signUpWithPhone(req.db, phone, password, code, safety)
    return res.success(result)
  } catch (e) { res.error(e) }
})

// 使用手机号/密码登录
router.get('/token', joiValidator({
  query: {
    username: Joi.string(),
    password: Joi.string().min(6),
    clientId: Joi.string().required(),
    type: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { username, password, clientId, type } = req.query
    let result = await userService.token(req.db, username, password, clientId, type)
    res.success(result)
  } catch (e) { res.error(e) }
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
    let result = await userService.recordDeviceUseInfo(req.db, id, clientId, type, sn)
    res.success()
  } catch (e) { console.log(e); res.error(e) }
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

/**
 * 添加绑定手机号
 */
router.post('/phone', joiValidator({
  body: {
    phone: Joi.string().min(11).max(11).required(),
    code: Joi.string().min(6).max(6).required(),
  }
}), cAuth, async (req, res) => {
  try {
    let { phone, code } = req.body
    let { id } = req.auth
    userService.bindPhone(req.db, id, phone, code)

    res.success()
  } catch (error) { res.error(error) }
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
    let { id } = req.auth
    let { code, type } = req.body
    let result = await userService.addWechat(req.db, id, code, type)
    res.success(result)
  } catch (e) {
    res.error(e)
  }
})



/**
 * 验证码换取token
 */
router.post('/smsCode', joiValidator({
  body: {
    phone: Joi.string().required(),
    code: Joi.string().required(),
    type: ['password']
  }
}), async (req, res) => {
  try {
    let { phone, code } = req.body
    let result = await userService.getPasswordToken(req.db, phone, code)
    res.success(result)
  } catch (error) { res.error(error) }
})

/**
 * 修改密码
 */
router.post('/password', joiValidator({
  body: {
    token: Joi.string().required(),
    phone: Joi.string().required(),
    password: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { token, phone, password } = req.body
    await userService.updatePasswordWithToken(req.db, token, phone, password)
    res.success()
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
    let { nickname } = req.body
    let result = await userService.updateNickname(req.db, id, nickname)
    res.success(result)
  } catch (error) { res.error(error) }
})

/**
 * 发送邮箱验证码: 绑定， 解绑， 修改密码
 */
router.post('/mail/code', joiValidator({
  body: {
    mail: Joi.string().required(),
    type: ['bind', 'unbind', 'password']
  }
}), async (req, res) => {
  try {
    let { mail, type } = req.body

    let result = await userService.createMailCode(req.db, mail, type)
    res.success(result)
  } catch (error) { res.error(error) }
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



module.exports = router
