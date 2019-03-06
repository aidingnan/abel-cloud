const express = require('express')
const router = express.Router()
const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const userService = require('../../../service/userService')
const { weAuth, cAuth } = require('../../../middlewares/jwt')

var timeout = require('connect-timeout')


router.use(timeout('15s'))

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
  } catch (e) { res.error(e) }
})

/**
 * 微信登录下关联用户
 */

router.patch('/user', cAuth,  joiValidator({
  body: {
    wechat: Joi.string().required(),
  }
}), weAuth, async (req, res) => {
  try {
    let { id, avatarUrl } = req.auth
    let result = await userService.wechatAssociateUser(req.db, id, req.wechat, avatarUrl)
    res.success(result)
  } catch (error) {
    console.log(error)
    res.error(error)
  }
})

/**
 * 查询用户微信
 */
router.get('/', cAuth, async (req, res) => {
  try {
    let { id } = req.auth
    res.success(await userService.getWechatInfo(req.db, id))
  } catch (error) { res.error(error) }
})



module.exports = router