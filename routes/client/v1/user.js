/*
 * @Author: harry.liu 
 * @Date: 2018-09-05 13:25:16 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-09-10 13:01:01
 */
const express = require('express')
const router = express.Router()

const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const userService = require('../../../service/userService')

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
  } catch (e) { console.log(e);res.error(e) }
})

// 使用手机号注册用户
router.post('/signUpWithPhone', joiValidator({
  body: {
    phone: Joi.string().min(11).max(11),
    code: Joi.string().min(6).max(6),
    password: Joi.string().min(6)
  }
}), async (req, res) => {
  try {
    let { phone, code, password } = req.body
    let result = await userService.signUpWithPhone(req.db, phone, password, code)
    return res.success(result)
  } catch (e) { res.error(e) }
})

router.post('/token', joiValidator({
  body: {
    username: Joi.string(),
    password: Joi.string().min(6)
  }
}), async (req, res) => {
  try {
    let { username, password } = req.body
    let result = await userService.token(req.db, username, password)
    return res.success(result)
  } catch (e) { res.error(e) }
})

// router.post('/wechat')






module.exports = router
