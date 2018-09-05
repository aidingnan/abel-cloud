/*
 * @Author: harry.liu 
 * @Date: 2018-09-05 13:25:16 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-09-05 15:51:00
 */
const express = require('express')
const router = express.Router()

const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const userService = require('../../../service/userService')

router.post('/register/requestSmsCode', joiValidator({
  body: {
    phone: Joi.string().min(11).max(11)
  }
}), (req, res) => {
  try {
    let { phone } = req.body
    let result = userService.requestSmsCode(phone)
    res.success(result)
  } catch (e) { res.error(e) }
})


module.exports = router
