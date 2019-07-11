const express = require('express')
const router = express.Router()
const userService = require('../../../service/userService')

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

module.exports = router