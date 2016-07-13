#!/usr/bin/env node

const exec = require('child_process').execFile
const fs = require('fs')
const path = require('path')

const phpPath = path.join(__dirname, '../gilded-wordpress.php')
let phpSource = fs.readFileSync(phpPath, 'utf8')

phpSource = phpSource.replace(
  /GW_VERSION', '([^']+)'/,
  `GW_VERSION', '${process.env.npm_package_version}'`
)

fs.writeFileSync(phpPath, phpSource)

exec('git', ['add', phpPath], { env: process.env }, (error) => {
  if (error) {
    console.error(error.stack)
    process.exitCode = 1
  }
})
