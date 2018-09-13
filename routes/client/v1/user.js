/*
 * @Author: harry.liu 
 * @Date: 2018-09-05 13:25:16 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-09-13 17:59:33
 */
const express = require('express')
const router = express.Router()

const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const userService = require('../../../service/userService')

const { weAuth, cAuth } = require('../../../middlewares/jwt')

//请求验证码
router.post('/requestSmsCode', joiValidator({
  body: {
    phone: Joi.string().min(11).max(11)
  }
}), async (req, res) => {
  try {
    let { phone } = req.body
    let result = await userService.requestSmsCode(req.db, phone)
    res.success(result)
  } catch (e) { console.log(e); res.error(e) }
})

// 使用手机号注册用户
router.post('/signUpWithPhone', joiValidator({
  body: {
    phone: Joi.string().min(11).max(11).required(),
    code: Joi.string().min(6).max(6).required(),
    password: Joi.string().min(6).required()
  }
}), weAuth, async (req, res) => {
  try {
    let { phone, code, password } = req.body
    let result = await userService.signUpWithPhone(req.db, phone, password, code, req.wechat)
    return res.success(result)
  } catch (e) { res.error(e) }
})

// 使用手机号/密码登录
router.post('/token', joiValidator({
  body: {
    username: Joi.string(),
    password: Joi.string().min(6)
  }
}), async (req, res) => {
  try {
    let { username, password } = req.body
    let result = await userService.token(req.db, username, password)
    res.success(result)
  } catch (e) { res.error(e) }
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
 * 微信登录
 */
router.get('/wechat', joiValidator({
  query: {
    code: Joi.string(),
    type: Joi.string()
  }
}), async (req, res) => {
  try {
    let { code, type } = req.query
    let user = await userService.loginWithWechat(req.db, code, type)
    res.success(user)
  } catch (e) {
    res.error(e)
  }
})

/**
 * 微信登录下绑定用户
 */

router.patch('/wechat')






module.exports = router
