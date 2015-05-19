#!/usr/bin/env node

var minimist = require('minimist')
var path = require('path')
var difffs = require('./')

var argv = minimist(process.argv.slice(2))

if (argv.version || argv.v) {
  console.log(require('./package.json').version)
  process.exit(0)
}

if (argv._.length < 2 || argv.help) {
  console.log('Usage: difffs [directory] [mountpoint]')
  process.exit(1)
}

var dir = argv._[0]
var mnt = argv._[1]
var diff = difffs(dir, mnt)

diff.on('data', function (change) {
  var info = Object.keys(change)
    .map(function (k) {
      if (k === 'path') return 'path: ' + path.join(dir, change.path.replace(diff.directory, '.'))
      if (k === 'data') return 'data: ' + change[k].length + ' bytes'
      return k + ': ' + change[k]
    })
    .filter(function (v) {
      return v
    })

  console.log(info.join(', '))
})

diff.on('mount', function () {
  console.log(dir + ' was mounted on ' + mnt)

  var exit = function () {
    setTimeout(process.kill.bind(process, process.pid), 2000).unref()
    process.removeListener('SIGTERM', exit)
    process.removeListener('SIGINT', exit)
    diff.unmount(function () {
      process.exit()
    })
  }

  process.on('SIGTERM', exit)
  process.on('SIGINT', exit)
})
