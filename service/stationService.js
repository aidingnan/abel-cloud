const crypto = require('crypto')
const Station = require('../models/station')
const User = require('../models/user')
const Phone = require('../models/phone')
const E = require('../lib/error')
const jwt = require('../lib/jwt')
const sendSmsCode = require('../lib/sendSmsCode')
const container = require('../service/task')
const uuid = require('uuid')

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
  async bindUser(connect, sn, certId, signature, encrypted) {
    try {
      let device = (await Station.findDeviceBySn(connect, sn))[0]
      if (device.owner !== null) throw new E.StationHasOwner()

      // 通过证书ID获取设备公钥
      let certResult = await describeCertificateAsync({ certificateId: certId })
      let { certificatePem, status } = certResult.certificateDescription

      // 通过公钥验证签名
      let verify = crypto.createVerify('SHA256').update(encrypted)
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
      // let device = await Station.findDeviceBySn(connect, sn)
      let user = (await User.getUserInfo(connect, id))[0]
      let result = await Station.bindUser(connect, sn, id)

      return Object.assign(user, { password: undefined })
    } catch (error) { throw error }
  }

  // 分享设备
  async addUser(connect, owner, sn, phone, setting, record) {
    try {
      let userExist = true, id
      // 检查owner 与 device 关系
      let deviceResult = await Station.findDeviceBySn(connect, sn)
      if (deviceResult.length !== 1) throw new E.StationNotExist()
      if (deviceResult[0].owner !== owner) throw new E.StationNotBelongToUser()
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
      if (userExist) await Station.createShare(connect, sn, id, setting)

      // 去除之前删除记录
      if (userExist) await Station.updateShareRecords(connect, sn, id, 'deprive', 'done')
      if (userExist) await Station.updateShareRecords(connect, sn, id, 'passiveExit', 'done')

      // 记录
      if (record) await Station.recordShare(connect, sn, owner, phone, id, 'invite', JSON.stringify(setting))

      try { await pulishUser(connect, sn) } catch (error) { console.log(error) }

      return { userExist }
    } catch (error) { throw error }
  }

  // 禁用设备
  async disableUser(connect, owner, sn, sharedUserId, disable) {
    try {
      // 检查owner 与 device 关系
      let deviceResult = await Station.findDeviceBySn(connect, sn)
      if (deviceResult.length !== 1) throw new E.StationNotExist()
      if (deviceResult[0].owner !== owner) throw new E.StationNotBelongToUser()
      // 检查分享用户ID
      let shareResult = await Station.getStationSharer(connect, sn)
      let user = shareResult.find(item => item.id == sharedUserId && item.isDeleted == 0)
      if (!user) throw new E.UserNotExistInStation()

      // disable
      await Station.disableUser(connect, sn, sharedUserId, disable)

    } catch (error) { throw error }
  }

  // 取消分享
  async deleteUser(connect, owner, sn, sharedUserId, ticket) {
    try {
      // 检查owner 与 device 关系
      let deviceResult = await Station.findDeviceBySn(connect, sn)
      if (deviceResult.length !== 1) throw new E.StationNotExist()
      if (deviceResult[0].owner !== owner) throw new E.StationNotBelongToUser()
      // 检查分享用户ID
      let shareResult = await Station.getStationSharer(connect, sn)
      let user = shareResult.find(item => item.id == sharedUserId && item.isDeleted == 0)
      if (!user) throw new E.UserNotExistInStation()
      
      // 校验验证码
      let smsResult = await Phone.getSmsCodeTicketInfo(connect, ticket)
      // 验证码失败
      if (smsResult.length == 0) throw new E.SmsCodeError()
      let { code } = smsResult[0]
      
      // delete
      await Station.deleteShare(connect, sn, sharedUserId, code)

      // 记录
      await Station.recordShare(connect, sn, owner, null, sharedUserId, 'deprive', null, code, 'done')

      // 更新ticket 状态
      await User.updateSmsRecordStatus(connect, ticket, 'consumed')

      try {
        await pulishUser(connect, sn)
      } catch (error) { console.log(error) }

    } catch (error) { throw error }
  }

  // 删除设备
  async deleteStation(connect, sn, userId, ticket) {
    try {
      // 验证ticket
      let ticketResult = await Phone.getSmsCodeTicketInfo(connect, ticket)
      if (!ticketResult.length) throw new E.PhoneTicketInvalid()
      if (ticketResult[0].type !== 'deviceChange') throw new Error('ticket type error')
      let { code } = ticketResult[0]

      // 检查设备类型(owner or share)
      let ownStations = await Station.getStationBelongToUser(connect, userId)
      let sharedStations = await Station.getStationSharedToUser(connect, userId)
      let ownStation = ownStations.find(item => item.sn == sn)
      let sharedStation = sharedStations.find(item => item.sn == sn && !item.isDeleted)
      if (!ownStation && !sharedStation) throw new E.StationNotExist()
      if (ownStation) {
        // 需要删除用户下所有设备

        await Station.unbindUser(connect, sn)
        await Station.recordShare(connect, sn, userId, null, userId, 'unbind')
        let userResult = await Station.getStationSharer(connect, sn)
        
        for(let i = 0; i < userResult.length; i++) {
          if (userResult[i].isDeleted) return
          let r = (Math.random()).toString()
          let c = r.slice(-4, r.length)
          await Station.deleteShare(connect, sn, userResult[i].id)
          await Station.recordShare(connect, sn, userId, null, userResult[i].id, 'passiveExit', null, code, 'todo')
          await sendSmsCode(userResult[i].username, c, 'deviceChange')
        }
        
      } else if (sharedStation) {
        // 仅删除个人绑定关系
        let { owner } = sharedStation
        await Station.deleteShare(connect, sn, userId, code )
        await Station.recordShare(connect, sn, owner, null, userId, 'activeExit', null, code)

        try {
          await pulishUser(connect, sn)
        } catch (error) { console.log(error) }
      }

    } catch (error) { throw error }
  }

  async confirmDelete(connect, sn, userId, operationCode) {
    try {
      let recordResult = await Station.getDeleteRecord(connect, sn, userId, operationCode)
      
      if (recordResult.length == 0) throw new Error('delete not exist')
      let { id } = recordResult[0]
      
      await Station.confirmDelete(connect, sn, userId, operationCode)
      await Station.updateShareRecord(connect, id, 'done')
    } catch (error) { throw error }
  }

  // 恢复出厂设置
  async resetStation(connect, sn, owner, tickets, req, res) {
    try {
      // 检查owner 与 device 关系
      let deviceResult = await Station.findDeviceBySn(connect, sn)
      if (deviceResult.length !== 1) throw new E.StationNotExist()
      if (deviceResult[0].owner !== owner) throw new E.StationNotBelongToUser()
      let station = deviceResult[0]
      // 获取设备的用户
      let users = (await Station.getStationSharer(connect, sn)).map(item => { 
        return {id: item.id, username: item.username, hasCode: false, code: null}})
      // 检查tickets
      for (let i = 0; i < tickets.length; i++) {
        
        let ticketResult = await Phone.getSmsCodeTicketInfo(connect, tickets[i])
        if (ticketResult.length !== 1) throw new Error(`ticket ${tickest[i]} error`)
        let ticket = ticketResult[0]
        let user = users.find(item => item.username == ticket.phone)
        if (!user) throw new Error(`ticket ${tickest[i]} error`)
        else {
          user.hasCode = true
          user.code = ticket.code
        }
      }

      let taskId = uuid.v4()
      let cookie = req.headers['cookie']
      let manifest = { users, cookie, taskId }

      container.add(res, sn, manifest, taskId)
    } catch (error) { console.log(error);res.error(error) }
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
      return { owner, sharer }
    } catch (error) { throw error }
  }

  // 查询设备下某用户记录
  async getStationRecord(connect, sn, userId) {
    try {
      return await Station.getStationRecord(connect, sn, userId)
    } catch (error) { throw error}
  }

  // 更新设备下用户设置
  async updateStationUser(connect, ownerId, sn, userId, setting) {
    try {
      let ownerResult = await Station.getStationOwner(connect, sn)
      let shareResult = await Station.getStationSharer(connect, sn)
      if (!ownerResult.find(item => item.id == ownerId)) throw new E.StationNotBelongToUser()
      if (!shareResult.find(item => item.id == userId)) throw new E.UserNotExistInStation()
      await Station.updateStationUser(connect, sn, userId, setting)

      try {
        await pulishUser(connect, sn)
      } catch (error) { console.log(error) }

      return await Station.getStationSharer(connect, sn)
    } catch (error) { throw error }
  }
}

module.exports = new StationService()