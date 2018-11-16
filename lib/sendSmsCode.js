const SMSClient = require('@alicloud/sms-sdk')
const config = require('getconfig')

var { accessKeyId, secretAccessKey } = config.smsCode

const smsClient = new SMSClient({ accessKeyId, secretAccessKey })

const sendSmsCode = (phone, code, templateCode) => {
  return new Promise((resolve, reject) => {
    console.log(phone)
    smsClient.sendSMS({
      PhoneNumbers: phone,
      SignName: '闻上科技',
      TemplateCode: templateCode,
      TemplateParam: `{"code":"${code}"}`
    }).then(res => resolve(res)
    , err => {
      reject(err)
    })
  })
}

module.exports = sendSmsCode