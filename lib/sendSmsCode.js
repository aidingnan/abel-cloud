const SMSClient = require('@alicloud/sms-sdk')
const config = require('getconfig')

var { accessKeyId, secretAccessKey } = config.smsCode

const smsClient = new SMSClient({ accessKeyId, secretAccessKey })

const templateCodeMap = {
  register: 'SMS_151010078',
  password: 'SMS_151010077',
  replace: 'SMS_151010076',
  login: 'SMS_151010080',
  mail: 'SMS_151010081'
}

const sendSmsCode = (phone, code, type) => {
  return new Promise((resolve, reject) => {
    console.log(phone)
    smsClient.sendSMS({
      PhoneNumbers: phone,
      SignName: '闻上科技',
      TemplateCode: templateCodeMap[type],
      TemplateParam: `{"code":"${code}"}`
    }).then(res => resolve(res)
    , err => {
      reject(err)
    })
  })
}

module.exports = sendSmsCode