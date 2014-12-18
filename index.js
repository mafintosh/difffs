var f4js = require('fuse4js')
var fs = require('fs')
var path = require('path')
var proc = require('child_process')
var events = require('events')

var toErrno = function(err) {
  if (err.code === 'EPERM') return -1
  if (err.code === 'ENOENT') return -2
  return -1
}

module.exports = function(from, mnt) {
  var handlers = {}
  var that = new events.EventEmitter()
  var filenames = []

  from = path.resolve(from)

  handlers.getattr = function(pathname, cb) {
    fs.stat(path.join(from, pathname), function(err, st) {
      if (err) return cb(toErrno(err))
      cb(0, st)
    })
  }

  handlers.readdir = function(pathname, cb) {
    fs.readdir(path.join(from, pathname), function(err, files) {
      if (err) return cb(toErrno(err))
      cb(0, files)
    })
  }

  var toFlag = function(flags) {
    flags = flags & 3
    if (flags === 0) return 'r'
    if (flags === 1) return 'w'
    return 'r+'
  }

  handlers.open = function(pathname, flags, cb) {
    fs.open(path.join(from, pathname), toFlag(flags), function(err, fd) {
      if (err) return cb(toErrno(err))
      cb(0, fd)
    })
  }

  handlers.release = function(pathname, handle, cb) {
    fs.close(handle, function(err) {
      if (err) return cb(toErrno(err))
      cb(0)
    })
  }

  handlers.read = function(pathname, offset, len, buf, handle, cb) {
    fs.read(handle, buf, 0, len, offset, function(err, bytes) {
      if (err) return cb(toErrno(err))
      cb(0, bytes)
    })
  }

  handlers.truncate = function(pathname, size, cb) {
    fs.truncate(path.join(from, pathname), function(err) {
      if (err) return cb(toErrno(err))
      cb(0)
    })
  }

  handlers.write = function(pathname, offset, len, buf, handle, cb) {
    fs.write(handle, buf, 0, len, offset, function(err, bytes) {
      if (err) return cb(toErrno(err))
      cb(bytes)
    })
  }

  handlers.unlink = function(pathname, cb) {
    fs.unlink(path.join(from, pathname), function(err) {
      if (err) return cb(toErrno(err))
      cb(0)
    })
  }

  handlers.rename = function(src, dst, cb) {
    fs.rename(path.join(from, src), path.join(from, dst), function(err) {
      if (err) return cb(toErrno(err))
      cb(0)
    })
  }

  handlers.mkdir = function(pathname, mode, cb) {
    fs.mkdir(path.join(from, pathname), mode, function(err) {
      if (err) return cb(toErrno(err))
      cb(0)
    })
  }

  handlers.rmdir = function(pathname, cb) {
    fs.rmdir(path.join(from, pathname), function(err) {
      if (err) return cb(toErrno(err))
      cb(0)
    })
  }

  handlers.chown = function() {
    console.error('chown is not implemented')
  }

  handlers.chmod = function(pathname, mode, cb) {
    fs.chmod(path.join(from, pathname), mode, function(err) {
      if (err) return cb(toErrno(err))
      cb(0)
    })
  }

  handlers.create = function(pathname, mode, cb) {
    fs.open(path.join(from, pathname), 'a', mode, function(err, fd) {
      if (err) return cb(toErrno(err))
      cb(0, fd)
    })
  }

  handlers.getxattr = function(pathname, cb) {
    cb(toErrno(err))
  }

  handlers.setxattr = function(pathname, name, value, size, a, b, cb) {
    cb(0)
  }

  handlers.statfs = function(cb) {
    cb(0, {
      bsize: 1000000,
      frsize: 1000000,
      blocks: 1000000,
      bfree: 1000000,
      bavail: 1000000,
      files: 1000000,
      ffree: 1000000,
      favail: 1000000,
      fsid: 1000000,
      flag: 1000000,
      namemax: 1000000
    })
  }

  handlers.destroy = function(cb) {
    cb()
  }

  proc.exec('umount '+JSON.stringify(mnt), function() {
    f4js.start(mnt, handlers, false, [])
    that.emit('mount')  
  })

  return that
}