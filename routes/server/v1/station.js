const express = require('express')
const router = express.Router()
const stationService = require('../../../service/stationService')
const transformJson = require('../../../service/transformJson')
const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')

router.post('/bind', joiValidator({
  body: {
    encrypted: Joi.string().required(),
    signature: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { encrypted, signature } = req.body
    let { sn, certId } = req.auth
    let result = await stationService.bindUser(req.db, sn, certId, signature, encrypted)
    res.success(result)

  } catch (error) { res.error(error) }
})

router.post('/:id/response/:jobId/json', async (req, res) => {
  try {
    transformJson.request(req, res)
  } catch(e) { res.error(e)}
})

module.exports = router