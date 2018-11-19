const AWS = require('aws-sdk')

const ssm = new AWS.SSM({
    region: 'cn-north-1'
  })

ssm.getParameters({
    Names:['iot', 'rds', 'rds-test']
  }, (err, stdout, stderr) => {
    if (err) return console.error(err)
    else if (stdout) return console.log(stdout)
  })
  

