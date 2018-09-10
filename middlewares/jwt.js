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

const jwt = require('../lib/jwt')
const User = require('../models/user')

module.exports = {
	/**
	 * client authorization
	 * @param {any} req 
	 * @param {any} res 
	 * @param {any} next 
	 */
  async cAuth(req, res, next) {
    const token = req.headers.authorization
    // decode
    try {
      const decoded = jwt.decode(token)
      if (!decoded)
        return res.error(new Error('decode failed'), 401, false)

      // expire
      if (!decoded.exp || decoded.exp <= Date.now())
        return res.error(new Error('token overdue, login again please！'), 401)

      if (!decoded.id)
        return res.error(new Error('authentication failed'), 401, false)

      let user = await User.getUserById(req.db, decoded.id)
      
      if (user.length !== 1) return res.error(new E.UserNotExist(), 401, false)

      req.auth = decoded
      next()

    } catch (error) {
      return res.error(new Error('authentication failed'), 401, false)
    }
  },
	/**
	 * station authorization
	 * @param {any} req 
	 * @param {any} res 
	 * @param {any} next 
	 */
  async sAuth(req, res, next) {
    const aut = req.headers.authorization
    let arr = aut.split('@')
    let latest = arr[0]
    let token = arr[1]
    let secretResult = await getParameterAsync({Name:'tokenKeys'})
    let { keys } = JSON.parse(secretResult.Parameter.Value)
    let secret = keys[latest]
    // decode
    try {
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
