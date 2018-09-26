/*
 * @Author: harry.liu 
 * @Date: 2018-09-05 13:25:16 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-09-26 14:18:23
 */
const express = require('express')
const router = express.Router()

const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const userService = require('../../../service/userService')
const { weAuth, cAuth } = require('../../../middlewares/jwt')

//请求验证码
router.get('/smsCode', weAuth(), joiValidator({
  query: {
    phone: Joi.string().min(11).max(11)
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
    password: Joi.string().min(6).required()
  }
}), async (req, res) => {
  try {
    let { phone, code, password } = req.body
    let result = await userService.signUpWithPhone(req.db, phone, password, code)
    return res.success(result)
  } catch (e) { res.error(e) }
})

// 使用手机号/密码登录
router.get('/token', joiValidator({
  query: {
    username: Joi.string(),
    password: Joi.string().min(6)
  }
}), async (req, res) => {
  try {
    let { username, password } = req.query
    let result = await userService.token(req.db, username, password)
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
   } catch (e) { res.error(e)}
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
  } catch (error) { res.error(error)}
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
}),cAuth, async (req, res) => {
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
 * 修改密码
 */

 router.patch('/password', joiValidator({
   body: {
     oldPassword: Joi.string().min(6).required(),
     newPassword: Joi.string().min(6).required()
   }
 }), async (req, res) => {
   try {

   } catch (error) { res.error(error) }
 })





module.exports = router
