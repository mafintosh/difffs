#!/usr/bin/env node

var minimist = require('minimist')
var difffs = require('./')

var argv = minimist(process.argv.slice(2))

if (argv._.length < 2 || argv.help) {
  console.log('Usage: difffs [directory] [mountpoint]')
  process.exit(1)
}

var diff = difffs(argv._[0], argv._[1])

diff.on('change', function (change) {
  var info = Object.keys(change)
    .map(function (k) {
      if (k === 'type' || k === 'path' || k === 'data') return null
      return k + ': ' + change[k]
    })
    .filter(function (v) {
      return v
    })

  console.log(change.path + ' (' + change.type + ') ' + info.join(' '))
})

diff.on('mount', function () {
  console.log(diff.directory + ' was mounted on ' + diff.mountpoint)

  var exit = function () {
    diff.unmount(function () {
      process.exit()
    })
  }

  process.on('SIGINT', exit)
})
