const fs = require('fs')
const path = require('path')
const Sequelize = require('mysql')


const { mysql } = require('getconfig')

console.log(mysql)

// let sequelize = new Sequelize(mysql.database, mysql.username, mysql.password, mysql)
let db = {}

fs
  .readdirSync(__dirname)
  .filter(function (file) {
    return (file.indexOf('.') !== 0) && (file !== 'index.js')
  })
  .forEach(function (file) {
    let model = require(path.join(__dirname, file))
    console.log(model)
    db[model.name] = model
  })


module.exports = db
