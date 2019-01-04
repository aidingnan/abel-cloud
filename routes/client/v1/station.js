/*
 * @Author: harry.liu 
 * @Date: 2018-09-10 11:02:15 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2019-01-04 17:29:27
 */

const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const Joi = require('joi')
const joiValidator = require('../../../middlewares/joiValidator')
const stationService = require('../../../service/stationService')
const transformJson = require('../../../service/transformJson')
const storeFile = require('../../../service/storeFile')
const fetchFile = require('../../../service/fetchFile')
const Station = require('../../../models/station')
var timeout = require('connect-timeout')

// json操作
router.post('/:sn/json', checkUserAndStation, (req, res) => {
  transformJson.createServer(req, res)
})

// 上传文件
router.post('/:sn/pipe', joiValidator({
  query: { data: Joi.string().required() }
}), checkUserAndStation, (req, res) => {
  storeFile.createServer(req, res)
})

// 下载文件
router.get('/:sn/pipe', joiValidator({
  query: { data: Joi.string().required() }
}), checkUserAndStation, (req, res) => {
  fetchFile.createServer(req, res)
})

router.use(timeout('15s'))

// 绑定设备
router.post('/', async (req, res) => {
  try {
    // 获取 user id
    let { id } = req.auth
    let user = { id }
    // 获取 cloud key
    let cloudKey = await getParameterAsync({ Name: 'cloudKeys' })
    let value = JSON.parse(cloudKey.Parameter.Value)
    let { keys, latest } = value
    let key = keys[latest]
    // 加密user
    let cipher = crypto.createCipher('aes128', key)
    let encrypted = cipher.update(JSON.stringify(user), 'utf8', 'hex')
    encrypted += cipher.final('hex')

    let result = { encrypted: `${latest}@${encrypted}` }
    res.success(result)
  } catch (error) { console.log(error); res.error(error) }
})

// 删除设备
router.delete('/', joiValidator({
  body: {
    sn: Joi.string().required(),
    ticket: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { id } = req.auth
    let { sn, ticket } = req.body
    let result = await stationService.deleteStation(req.db, sn, id, ticket)
    res.success(result)
  } catch (error) { res.error(error) }
})

router.post('/:sn/reset', joiValidator({
  body: {
    tickets: Joi.array().required()
  }
}), async (req, res) => {
  try {
    let { id } = req.auth
    let { sn } = req.params
    let { tickets } = req.body
    await stationService.resetStation(req.db, sn, id, tickets, req, res)
  } catch (error) { res.error(error) }
})

// 查询某台station下用户
router.get('/:sn/user', async (req, res) => {
  try {
    let { id } = req.auth
    let { sn } = req.params
    let result = await stationService.getStationUsers(req.db, sn)
    res.success(result)
  } catch (e) { res.error(e) }
})

// 查询所有设备
router.get('/', async (req, res) => {
  try {
    let { id, clientId, type } = req.auth
    let result = await stationService.getStations(req.db, id, clientId, type)
    res.success(result)
  } catch (e) { res.error(e) }
})

// 分享设备
router.post('/:sn/user', joiValidator({
  params: { sn: Joi.string().required() },
  body: {
    phone: Joi.string().required(),
    setting: Joi.object({
      cloud: Joi.number().valid(1).required(),
      publicSpace: Joi.number().valid(0, 1).required()
    }).required()
  }
}), async (req, res) => {
  try {
    // 获取owner
    let { id } = req.auth
    // 获取设备ID & 对象ID
    let { sn } = req.params
    let { phone, setting } = req.body
    let result = await stationService.addUser(req.db, id, sn, phone, setting, true)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 取消分享设备
router.delete('/:sn/user/:userId', joiValidator({
  params: { 
    sn: Joi.string().required(),
    userId: Joi.string().required()
  },
  body: {
    ticket: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { id } = req.auth
    let { sn, userId } = req.params
    let { ticket } = req.body
    let result = await stationService.deleteUser(req.db, id, sn, userId, ticket)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 禁用设备
router.patch('/:sn/user/:userId', joiValidator({
  params: {
    sn: Joi.string().required(),
    userId: Joi.string().required()
  },
  body: { disable: Joi.number().required() }
}), async (req, res) => {
  let { sn, userId } = req.params
  let { id } = req.auth
  let { disable } = req.body
  let result = await stationService.disableUser(req.db, id, sn, userId, disable)
  res.success(result)
})

// 设备下用户设置
router.patch('/:sn/user', joiValidator({
  params: { sn: Joi.string()},
  body: { 
    sharedUserId: Joi.string().required(),
    setting: Joi.object({ publicSpace: Joi.number().valid(0, 1) }).required() }
}), async (req, res) => {
  try {
    let { id } = req.auth
    let { sn } = req.params
    let { setting, sharedUserId } = req.body
    if (Object.getOwnPropertyNames(setting).length == 0) throw new Error('invalid params')
    let result = await stationService.updateStationUser(req.db, id, sn, sharedUserId, setting)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 查询设备下某用户记录
router.get('/:sn/user/record', async (req, res) => {
  try {
    let { sn } = req.params
    let { id } = req.auth
    let result = await stationService.getStationRecord(req.db, sn, id)
    res.success(result)
  } catch (error) { res.error(error) }
})

// 确认删除
router.patch('/:sn/user/record', joiValidator({
  params: { sn: Joi.string() },
  body: {
    code: Joi.string().required()
  }
}), async (req, res) => {
  try {
    let { sn } = req.params
    let { id } = req.auth
    let { code } = req.body
    let result = await stationService.confirmDelete(req.db, sn, id, code)
    res.success(result)
  } catch (error) { res.error(error) }
})

async function checkUserAndStation(req, res, next) {
  // return next()
  try {
    let userId = req.auth.id
    let sn = req.params.sn
    let connect = req.db
    // 查询station
    let ownStations = await Station.getStationBelongToUser(connect, userId)
    let sharedStations = await Station.getStationSharedToUser(connect, userId)
    let sameOwnStation = ownStations.find(item => item.sn == sn)
    let sameSharedStations = sharedStations.find(item => item.sn == sn  && !item.disable)
    if (!sameOwnStation && !sameSharedStations) throw new Error('sn not belong to user')

    let station = sameOwnStation || sharedStations
    // if (!station.online) throw new Error('Station is not online')

    next()
  } catch (e) { res.error(e) }
}

module.exports = router