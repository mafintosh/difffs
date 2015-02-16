var f4js = require('fuse4js')
var fs = require('fs')
var path = require('path')
var proc = require('child_process')
var events = require('events')
var errno = require('./errno')

module.exports = function(from, mnt) {
  var handlers = {}
  var that = new events.EventEmitter()

  that.directory = from
  that.mountpoint = mnt

  that.on('change', function(change) {
    that.emit(change.type, change)
  })

  from = path.resolve(from)

  handlers.getattr = function(pathname, cb) {
    fs.stat(path.join(from, pathname), function(err, st) {
      if (err) return cb(-errno(err))
      cb(0, st)
    })
  }

  handlers.readdir = function(pathname, cb) {
    fs.readdir(path.join(from, pathname), function(err, files) {
      if (err) return cb(-errno(err))
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
    pathname = path.join(from, pathname)
    flags = toFlag(flags)

    fs.open(pathname, flags, function(err, fd) {
      if (err) return cb(-errno(err))
      if (flags === 'w') that.emit('change', {type:'create', path:pathname})
      cb(0, fd)
    })
  }

  handlers.release = function(pathname, handle, cb) {
    fs.close(handle, function(err) {
      if (err) return cb(-errno(err))
      cb(0)
    })
  }

  handlers.read = function(pathname, offset, len, buf, handle, cb) {
    fs.read(handle, buf, 0, len, offset, function(err, bytes) {
      if (err) return cb(-errno(err))
      cb(bytes)
    })
  }

  handlers.truncate = function(pathname, size, cb) {
    pathname = path.join(from, pathname)
    fs.truncate(pathname, function(err) {
      if (err) return cb(-errno(err))
      that.emit('change', {type:'truncate', path:pathname, size:size})
      cb(0)
    })
  }

  handlers.write = function(pathname, offset, len, buf, handle, cb) {
    pathname = path.join(from, pathname)
    fs.write(handle, buf, 0, len, offset, function(err, bytes) {
      if (err) return cb(-errno(err))
      that.emit('change', {type:'write', path:pathname, offset:offset, bytes:bytes, data:buf})
      cb(bytes)
    })
  }

  handlers.unlink = function(pathname, cb) {
    pathname = path.join(from, pathname)
    fs.unlink(pathname, function(err) {
      if (err) return cb(-errno(err))
      that.emit('change', {type:'unlink', path:pathname})
      cb(0)
    })
  }

  handlers.rename = function(src, dst, cb) {
    src = path.join(from, src)
    dst = path.join(from, dst)
    fs.rename(src, dst, function(err) {
      if (err) return cb(-errno(err))
      that.emit('change', {type:'rename', path:src, destination:dst})
      cb(0)
    })
  }

  handlers.mkdir = function(pathname, mode, cb) {
    pathname = path.join(from, pathname)
    fs.mkdir(pathname, mode, function(err) {
      if (err) return cb(-errno(err))
      that.emit('change', {type:'mkdir', path:pathname, mode:mode})
      cb(0)
    })
  }

  handlers.rmdir = function(pathname, cb) {
    pathname = path.join(from, pathname)
    fs.rmdir(pathname, function(err) {
      if (err) return cb(-errno(err))
      that.emit('change', {type:'rmdir', path:pathname})
      cb(0)
    })
  }

  handlers.chown = function() {
    console.error('chown is not implemented')
  }

  handlers.chmod = function(pathname, mode, cb) {
    pathname = path.join(from, pathname)
    fs.chmod(pathname, mode, function(err) {
      if (err) return cb(-errno(err))
      that.emit('change', {type:'chmod', path:pathname, mode:mode})
      cb(0)
    })
  }

  handlers.create = function(pathname, mode, cb) {
    pathname = path.join(from, pathname)
    fs.open(pathname, 'a', mode, function(err, fd) {
      if (err) return cb(-errno(err))
      that.emit('change', {type:'create', path:pathname, mode:mode})
      cb(0, fd)
    })
  }

  handlers.getxattr = function(pathname, cb) {
    cb(-errno(err))
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
