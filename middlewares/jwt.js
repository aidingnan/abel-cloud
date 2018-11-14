/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   jwt.js                                             :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: Jianjin Wu <mosaic101@foxmail.com>         +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2017/12/18 16:01:04 by Jianjin Wu        #+#    #+#             */
/*   Updated: 2018/03/30 14:49:36 by Jianjin Wu       ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

const promise = require('bluebird')
const jwt = require('../lib/jwt')
const User = require('../models/user')
const WechatInfo = require('../lib/wechatInfo')

module.exports = {
	/**
	 * client authorization
	 * @param {any} req 
	 * @param {any} res 
	 * @param {any} next 
	 */
  async cAuth(req, res, next) {
    const token = req.headers.authorization
    try {
      // 解码
      const decoded = jwt.decode(token)
      // 解码失败
      if (!decoded)
        return res.error(new Error('decode failed'), 401, false)

      // todo 超时 code!!!
      // token超时
      if (!decoded.exp || decoded.exp <= Date.now())
        return res.error(new Error('token overdue, login again please！'), 401)

      // 解码内容错误
      if (!decoded.id)
        return res.error(new Error('authentication failed'), 401, false)

      // 检查用户
      let user = await User.getUserInfo(req.db, decoded.id)
      if (user.length !== 1) 
        return res.error(new E.UserNotExist(), 401, false)

      // 附加验证结果
      req.auth = decoded
      next()

    } catch (error) {
      res.error(new Error('authentication failed'), 401, false)
    }
  },

  weAuth(necessary) {
    return async (req, res, next) => {
      let { wechat } = req.headers
      // 解码
      try {
        // 微信用户不存在
        if (!wechat && !necessary) return next()
        // 微信用户存在
        let decoded = jwt.decode(wechat)
        if (!decoded) res.error('decode failed', 401, false)
        // 获取微信用户信息
        let { access_token, openid } = decoded
        let wechatInfo = new WechatInfo()
        let getUserInfo = promise.promisify(wechatInfo.userInfo).bind(wechatInfo)
        let userInfo = await getUserInfo(access_token, openid)
        // 检查数据库是否存在对应用户
        let { unionid } = userInfo
        let user = await User.findWechatAndUserByUnionId(req.db, unionid)
        if (user.length !== 1) return res.error(new Error('wechat user not exist'), 401, false)
        req.wechat = user[0]

        next()

      } catch (error) {
        res.error(new Error('authentication failed'), 401, false)
      }
    }
  },

	/**
	 * station authorization
	 * @param {any} req 
	 * @param {any} res 
	 * @param {any} next 
	 */
  async sAuth(req, res, next) {


    try {
      const aut = req.headers.authorization
      let arr = aut.split('@')
      let latest = arr[0]
      let token = arr[1]
      let secretResult = await getParameterAsync({ Name: 'tokenKeys' })
      let { keys } = JSON.parse(secretResult.Parameter.Value)
      let secret = keys[latest]

      // decode
      const decoded = jwt.decode(token, secret)
      if (!decoded)
        return res.error(new Error('decode failed'), 401, false)

      // no expire
      // if (!decoded.station)
      //   return res.error(new Error('authentication failed'), 401, false)

      // let station = await Station.find({
      //   where: {
      //     id: decoded.station.id
      //   },
      //   raw: true
      // })
      // if (!station) return res.error(new E.StationNotExist(), 401, false)

      req.auth = decoded
      next()

    } catch (error) {
      console.log(error)
      return res.error(new Error('authentication failed'), 401, false)
    }
  }
}
