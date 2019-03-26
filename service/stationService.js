const crypto = require('crypto')
const Station = require('../models/station')
const User = require('../models/user')
const Phone = require('../models/phone')
const E = require('../lib/error')
const jwt = require('../lib/jwt')
const sendSmsCode = require('../lib/sendSmsCode')
const container = require('../service/task')
const uuid = require('uuid')
const promise = require('bluebird')
const request = require('request')

promise.promisifyAll(request)

const pulishUser = async (connect, sn) => {
  let owner = await Station.getStationOwner(connect, sn)
  let sharer = await Station.getStationSharer(connect, sn)
  let topic = `cloud/${sn}/users`
  let qos = 1
  let payload = JSON.stringify({ owner, sharer })
  let obj = { topic, qos, payload }
  let r = await publishAsync(obj)
}

class StationService {
  async bindUser(connect, sn, certId, signature, encrypted, raw) {
    let newConnect = promise.promisifyAll(await connect.getConnectionAsync())
    try {
      // 通过sn查找设备
      let device = (await Station.findDeviceBySn(connect, sn))[0]
      if (device.owner !== null) throw new E.StationHasOwner()

      // 通过证书ID获取设备公钥
      let certResult = await describeCertificateAsync({ certificateId: certId })
      let { certificatePem, status } = certResult.certificateDescription

      // 通过公钥验证签名
      let verify = crypto.createVerify('SHA256').update(raw)
      let verifyResult = verify.verify(certificatePem, signature, 'hex')

      if (status !== 'ACTIVE') throw new E.StationCertInactive()
      if (!verifyResult) throw new E.StationVerifyFailed()

      // 解密encrypted
      let arr = encrypted.split('@')
      let latest = arr[0]
      let encrypted2 = arr[1]
      let cloudKey = await getParameterAsync({ Name: 'cloudKeys' })
      let { keys } = JSON.parse(cloudKey.Parameter.Value)
      let key = keys[latest]

      let decipher = crypto.createDecipher('aes128', key)
      let decrypted = decipher.update(encrypted2, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      let { id } = JSON.parse(decrypted)

      // 绑定用户
      let user = (await User.getUserInfo(connect, id))[0]
      await Station.createRelation(connect, sn, id, {}, 1)
      await Station.bindUser(connect, sn, id)
      // TODO: transaction
      // 更新device signature   TODO！
      await Station.updateSignature(newConnect, sn, signature, raw)

      return Object.assign(user, { password: undefined })
    } catch (error) { throw error }
  }

  async unbindUser(connect, sn, certId, encrypted, signature, raw) {
    try {
      let newConnect = promise.promisifyAll(await connect.getConnectionAsync())
      // 通过sn查找设备
      let device = (await Station.findDeviceBySn(connect, sn))[0]

      // 验证encrypted签名
      await verifySignature(certId, signature, raw)

      // 解密encrypted
      let { id } = await decipher(encrypted)
      // 检查device 与userId
      let deviceOwner = await Station.getStationOwner(connect, sn).filter(item => !item.delete)
      let deviceSharer = (await Station.getStationSharer(connect, sn)).filter(item => !item.delete)

      if (deviceOwner.length !== 1) throw new Error('station has no owner')
      if (deviceOwner[0].id !== id) throw new Error('encrypted user is not the owner of station')
      if (deviceSharer.length !== 0) throw new Error('station exist sharers')

      // 删除数据库关系
      try {
        await newConnect.queryAsync('BEGIN;')
        let updateRelationResult = await Station.deleteRelation(newConnect, sn, id)
        let updateStationResult = await Station.unbindUser(newConnect, sn)
        let updateSignResult = await Station.updateSignature(newConnect, sn, signature, raw)

        // 删除关系失败，回退
        if (updateRelationResult.affectedRows !== 1) throw new Error('udpate device_user failed')
        
        // 更新用户失败，回退
        if (updateStationResult.affectedRows !== 1) throw new Error('update station failed')

        if (updateSignResult.affectedRows !== 1) throw new Error('update station failed')
        
        await newConnect.queryAsync('COMMIT;')
      } catch (error) {
        await newConnect.queryAsync('ROLLBACK;')
        throw error
      }

    
    } catch (error) { throw error }
  }

  // 分享设备
  async addUser(connect, owner, sn, phone, setting, record) {
    try {
      let userExist = true, id
      // 检查user
      let userResult = await User.getUserWithPhone(connect, phone)
      if (userResult.length !== 1) userExist = false
      else id = userResult[0].id
      // 禁止分享给自己
      if (owner == id) throw new Error('station can not share to owner')
      // 禁止重复分享
      let relationResult = await Station.findDeviceShareBySnAndId(connect, sn, id)
      if (relationResult.length > 0) throw new E.ShareExist()
      // 建立绑定关系
      if (userExist) await Station.createRelation(connect, sn, id, setting, 0)

      // 去除之前删除记录
      if (userExist) await Station.updateShareRecords(connect, sn, id, 'deprive', 'done')
      if (userExist) await Station.updateShareRecords(connect, sn, id, 'passiveExit', 'done')

      // 记录
      if (record) await Station.recordShare(connect, sn, owner, phone, id, 'invite', JSON.stringify(setting))

      try { await pulishUser(connect, sn) } catch (error) { console.log(error) }

      return { userExist }
    } catch (error) { throw error }
  }

  // 取消分享
  async deleteUser(connect, owner, sn, sharedUserId, ticket) {
    try {
      // 检查分享用户ID
      let shareResult = await Station.getStationSharer(connect, sn)
      let user = shareResult.find(item => item.id == sharedUserId && item.delete == 0)
      if (!user) throw new E.UserNotExistInStation()

      // 校验验证码
      let smsResult = await Phone.getSmsCodeTicketInfo(connect, ticket)
      // 验证码失败
      if (smsResult.length == 0) throw new E.SmsCodeError()
      let { code } = smsResult[0]

      // delete
      await Station.deleteRelation(connect, sn, sharedUserId, code)

      // 记录
      await Station.recordShare(connect, sn, owner, null, sharedUserId, 'deprive', null, code, 'done')

      // 更新ticket 状态
      await Phone.updateSmsRecordStatus(connect, ticket, 'consumed')

      try {
        await pulishUser(connect, sn)
      } catch (error) { console.log(error) }

    } catch (error) { throw error }
  }

  // 禁用设备
  async disableUser(connect, owner, sn, sharedUserId, disable) {
    try {
      // 检查分享用户ID
      let shareResult = await Station.getStationSharer(connect, sn)
      let user = shareResult.find(item => item.id == sharedUserId && item.delete == 0)
      if (!user) throw new E.UserNotExistInStation()
      // update
      await Station.disableUser(connect, sn, sharedUserId, disable)

    } catch (error) { throw error }
  }

  // sharer删除设备
  async deleteStation(req, sn, userId, ticket) {
    let connect = req.db
    // 事务处理，单独建立connect
    let newConnect = promise.promisifyAll(await connect.getConnectionAsync())
    try {
      // 验证ticket
      let ticketResult = await Phone.getSmsCodeTicketInfo(connect, ticket)
      if (!ticketResult.length) throw new E.PhoneTicketInvalid()
      if (ticketResult[0].type !== 'deviceChange') throw new E.PhoneTicketInvalid()
      let { code } = ticketResult[0]

      // 检查设备类型(owner or share)
      let ownStations = await Station.getStationBelongToUser(connect, userId)
      let sharedStations = await Station.getStationSharedToUser(connect, userId)
      let ownStation = ownStations.find(item => item.sn == sn)
      let sharedStation = sharedStations.find(item => item.sn == sn && !item.delete)
      // if (!ownStation && !sharedStation) throw new E.StationNotExist()
      if (!sharedStation) throw new E.StationNotExist()

      if (false) {
        // 管理员删设备
        let shareUsers = (await Station.getStationSharer(connect, sn)).filter(item => !item.delete)
        let newManager = shareUsers.find(item => item.id == manager)
        if (shareUsers.length != 0 && !manager) throw new Error('new manager is required')
        // if (shareUsers.length != 0 && !newManager) throw new Error('new manager is not belong to station')

        if (true) {
          // 不存在其他用户 --> 标记管理员为删除
          console.log('不存在其他用户')

          return


        } else if (shareUsers.length > 0) {
          // 存在其他用户 --> 标记管理员为删除，转让管理员
          console.log('存在其他用户')
          await newConnect.queryAsync('BEGIN;')
          let deleteResult = await Station.deleteRelation(newConnect, sn, userId, code)
          let createResult = await Station.createRelation(newConnect, sn, manager, {}, 1)
          let updateResult = await Station.unbindUser(newConnect, sn, manager)
          if (deleteResult.affectedRows !== 1) await newConnect.queryAsync('ROLLBACK;')
          else if (createResult.affectedRows !== 2) await newConnect.queryAsync('ROLLBACK;')
          else if (updateResult.affectedRows !== 1) await newConnect.queryAsync('ROLLBACK;')
          else await newConnect.queryAsync('COMMIT;')
        }

      } else if (sharedStation) {
        // 非管理员删设备
        let { owner } = sharedStation
        await Station.deleteRelation(connect, sn, userId, code)
        await Station.recordShare(connect, sn, owner, null, userId, 'activeExit', null, code)

        try {
          await pulishUser(connect, sn)
        } catch (error) { console.log(error) }
      }

    } catch (error) {
      await newConnect.queryAsync('ROLLBACK;')
      console.log(error)
      throw error
    }
  }

  // 恢复出厂设置
  async resetStation(connect, sn, tickets, req, res) {
    try {
      // 获取设备的用户
      let users = (await Station.getStationSharer(connect, sn)).map(item => {
        return { id: item.id, username: item.username, hasCode: false, code: null }
      })
      // 检查tickets
      for (let i = 0; i < tickets.length; i++) {

        let ticketResult = await Phone.getSmsCodeTicketInfo(connect, tickets[i])
        if (ticketResult.length !== 1) throw new Error(`ticket ${tickets[i]} error`)
        let ticket = ticketResult[0]
        let user = users.find(item => item.username == ticket.phone)
        if (!user) throw new Error(`ticket ${tickets[i]} error`)
        else {
          user.hasCode = true
          user.code = ticket.code
        }
      }

      let sessionId = uuid.v4()
      let cookie = req.headers['cookie']
      let manifest = { users, headers: { cookie }, sessionId }

      container.add(req, res, sn, manifest, sessionId)
    } catch (error) { console.log(error); res.error(error) }
  }

  // 查询用户所有设备
  async getStations(connect, userId, clientId, type) {
    try {
      let ownStations = await Station.getStationBelongToUser(connect, userId)
      let sharedStations = await Station.getStationSharedToUser(connect, userId)
      let lastUseDevice = await User.getUseRecordInfo(connect, userId, clientId, type)
      let lastUseDeviceSn = null
      if (lastUseDevice.length == 1 && lastUseDevice[0].sn) {
        lastUseDeviceSn = lastUseDevice[0].sn
      }
      return { ownStations, sharedStations, lastUseDeviceSn }
    } catch (error) { throw error }
  }

  // 查询设备所有用户
  async getStationUsers(connect, sn) {
    try {
      let owner = await Station.getStationOwner(connect, sn)
      let sharer = await Station.getStationSharer(connect, sn)
      let users = await Station.getStationUsers(connect, sn)
      return { owner, sharer, users }
    } catch (error) { throw error }
  }

  // 更新设备下用户设置
  async updateStationUser(connect, sn, userId, setting) {
    try {
      await Station.updateStationUser(connect, sn, userId, setting)

      try { await pulishUser(connect, sn) } catch (error) { }

      return await Station.getStationSharer(connect, sn)
    } catch (error) { throw error }
  }
}

const verifySignature = async (certId, signature, raw) => {
  // 通过证书ID获取设备公钥
  let certResult = await describeCertificateAsync({ certificateId: certId })
  let { certificatePem, status } = certResult.certificateDescription

  // 通过公钥验证签名
  let verify = crypto.createVerify('SHA256').update(raw)
  let verifyResult = verify.verify(certificatePem, signature, 'hex')

  if (status !== 'ACTIVE') throw new E.StationCertInactive()
  // if (!verifyResult) throw new E.StationVerifyFailed()
}

const decipher = async (encrypted) => {
  // 解密encrypted
  let arr = encrypted.split('@')
  let latest = arr[0]
  let encrypted2 = arr[1]
  let cloudKey = await getParameterAsync({ Name: 'cloudKeys' })
  let { keys } = JSON.parse(cloudKey.Parameter.Value)
  let key = keys[latest]

  let decipher = crypto.createDecipher('aes128', key)
  let decrypted = decipher.update(encrypted2, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return JSON.parse(decrypted)
}

module.exports = new StationService()