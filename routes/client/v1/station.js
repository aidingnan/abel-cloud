/*
 * @Author: harry.liu 
 * @Date: 2018-09-10 11:02:15 
 * @Last Modified by: harry.liu
 * @Last Modified time: 2018-09-10 16:11:20
 */

const express = require('express')
const router = express.Router()
const crypto = require('crypto')

router.get('/')

router.get('/bind', async (req, res) => {
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

    let result = { encrypted: `${latest}@${encrypted}`}
    return res.success(result)
  } catch (error) {  res.error(error) }
})

module.exports = router