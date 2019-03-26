const express = require('express')
const router = express.Router()
const stationService = require('../../../service/stationService')
const transformJson = require('../../../service/transformJson')
const storeFile = require('../../../service/storeFile')
const fetchFile = require('../../../service/fetchFile')
const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const container = require('../../../service/task')

router.post('/bind', joiValidator({
  body: {
    encrypted: Joi.string().required(),
    signature: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { encrypted, signature } = req.body
    // req.auth = { sn: 'test_de3-2909-41b9-9849-bbca457d8844' }
    let { sn, certId } = req.auth
    let result = await stationService.bindUser(req.db, sn, certId, signature, encrypted)
    res.success(result)

  } catch (error) { res.error(error) }
})


router.post('/unbind', joiValidator({
  body: {
    encrypted: Joi.string().required(),
    signature: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { encrypted, signature } = req.body
    let { sn, certId } = req.auth
    let result = await stationService.unbindUser(req.db, sn. certId, signature, encrypted)
  } catch (error) {
    console.log(error)
    res.error(error)
  }
})

router.get('/user', async (req, res) => {
  try {
    let { sn } = req.auth
    let result = await stationService.getStationUsers(req.db, sn)
    res.success(result)
  } catch (e) { res.error(e) }
})

// json 返回
router.post('/:id/response/:jobId/json', async (req, res) => {
  try {
    console.log(req.headers.authorization)
    transformJson.response(req, res)
  } catch(e) { res.error(e) }
})

// station接收文件
router.get('/:id/response/:jobId', (req, res) => {
  try {
    storeFile.request(req, res)
  } catch(e) { res.error(e) }
})

// station处理文件返回
router.post('/:id/response/:jobId/pipe/store', (req, res) => {
  try {
    storeFile.response(req, res)
  } catch(e) { res.error(e) }
})

router.post('/:id/response/:jobId', (req, res) => {
  try {
    fetchFile.request(req, res)
  } catch(e) { res.error(e) }
})

router.post('/:id/response/:jobId/pipe/fetch', (req, res) => {
  try {
    fetchFile.response(req, res)
  } catch(e) { res.error(e) }
})

// task 返回
router.post('/:sn/reset/:jobId', joiValidator({
  body: {
    data: Joi.object().optional(),
    error: Joi.object().optional()
  }
}), (req, res) => {
  try {
    container.response(req, res)
  } catch (error) { res.error(error) }
})

module.exports = router