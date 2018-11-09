const express = require('express')
const router = express.Router()
const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const userService = require('../../../service/userService')
const { weAuth, cAuth } = require('../../../middlewares/jwt')

/**
 * 微信登录
 */
router.get('/token', joiValidator({
  query: {
    code: Joi.string(),
    loginType: Joi.string(),
    clientId: Joi.string().required(),
    type: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { code, loginType, clientId, type} = req.query
    let user = await userService.loginWithWechat(req.db, code, loginType, clientId, type)
    res.success(user)
  } catch (e) {
    res.error(e)
  }
})

/**
 * 微信登录下关联用户
 */

router.patch('/user', weAuth(true), joiValidator({
  body: {
    phone: Joi.string().required(),
    code: Joi.string().required(),
    password: Joi.string()
  }
}), async (req, res) => {
  try {
    let { phone, code, password } = req.body
    let result = await userService.wechatAssociateUser(req, phone, code, password)
    res.status(200).json(result)
  } catch (error) {
    console.log(error)
    res.error(error)
  }
})


module.exports = router