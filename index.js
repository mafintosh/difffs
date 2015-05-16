var fuse = require('fuse-bindings')
var mknod = require('mknod')
var fs = require('fs')
var path = require('path')
var events = require('events')

module.exports = function (from, mnt) {
  var handlers = {}
  var that = new events.EventEmitter()

  that.directory = from
  that.mountpoint = mnt

  from = path.resolve(from)
  mnt = path.resolve(mnt)

  that.unmount = function (cb) {
    fuse.unmount(mnt, cb)
  }

  that.on('change', function (change) {
    that.emit(change.type, change)
  })

  handlers.mknod = function (pathname, mode, dev, cb) {
    pathname = path.join(from, pathname)
    mknod(pathname, mode, dev, function (err) {
      if (err) return cb(fuse.EPERM)
      that.emit('change', {type: 'mknod', path: pathname, mode: mode, dev: dev})
      cb(0)
    })
  }

  handlers.getattr = function (pathname, cb) {
    fs.lstat(path.join(from, pathname), function (err, st) {
      if (err) return cb(fuse.errno(err.code))
      cb(0, st)
    })
  }

  handlers.fgetattr = function (pathname, fd, cb) {
    fs.lstat(fd, function (err, st) {
      if (err) return cb(fuse.errno(err.code))
      cb(0, st)
    })
  }

  handlers.readdir = function (pathname, cb) {
    fs.readdir(path.join(from, pathname), function (err, files) {
      if (err) return cb(fuse.errno(err.code))
      cb(0, files)
    })
  }

  var toFlag = function (flags) {
    flags = flags & 3
    if (flags === 0) return 'r'
    if (flags === 1) return 'w'
    return 'r+'
  }

  handlers.open = function (pathname, flags, cb) {
    pathname = path.join(from, pathname)
    flags = toFlag(flags)

    fs.open(pathname, flags, function (err, fd) {
      if (err) return cb(fuse.errno(err.code))
      if (flags === 'w') that.emit('change', {type: 'create', path: pathname})
      cb(0, fd)
    })
  }

  handlers.release = function (pathname, handle, cb) {
    fs.close(handle, function (err) {
      if (err) return cb(fuse.errno(err.code))
      cb(0)
    })
  }

  handlers.read = function (pathname, handle, buf, len, offset, cb) {
    fs.read(handle, buf, 0, len, offset, function (err, bytes) {
      if (err) return cb(fuse.errno(err.code))
      cb(bytes)
    })
  }

  handlers.truncate = function (pathname, size, cb) {
    pathname = path.join(from, pathname)
    fs.truncate(pathname, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'truncate', path: pathname, size: size})
      cb(0)
    })
  }

  handlers.write = function (pathname, handle, buf, len, offset, cb) {
    pathname = path.join(from, pathname)
    fs.write(handle, buf, 0, len, offset, function (err, bytes) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'write', path: pathname, offset: offset, bytes: bytes, data: buf})
      cb(bytes)
    })
  }

  handlers.unlink = function (pathname, cb) {
    pathname = path.join(from, pathname)
    fs.unlink(pathname, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'unlink', path: pathname})
      cb(0)
    })
  }

  handlers.symlink = function (src, dst, cb) {
    dst = path.join(from, dst)
    if (src === mnt || src.indexOf(mnt + path.sep) === 0) src = src.replace(mnt, from)
    fs.symlink(src, dst, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'symlink', path: src, destination: dst})
      cb(0)
    })
  }

  handlers.link = function (src, dst, cb) {
    dst = path.join(from, dst)
    if (src === mnt || src.indexOf(mnt + path.sep) === 0) src = src.replace(mnt, from)
    fs.link(src, dst, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'link', path: src, destination: dst})
      cb(0)
    })
  }

  handlers.rename = function (src, dst, cb) {
    src = path.join(from, src)
    dst = path.join(from, dst)
    fs.rename(src, dst, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'rename', path: src, destination: dst})
      cb(0)
    })
  }

  handlers.mkdir = function (pathname, mode, cb) {
    pathname = path.join(from, pathname)
    fs.mkdir(pathname, mode, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'mkdir', path: pathname, mode: mode})
      cb(0)
    })
  }

  handlers.rmdir = function (pathname, cb) {
    pathname = path.join(from, pathname)
    fs.rmdir(pathname, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'rmdir', path: pathname})
      cb(0)
    })
  }

  handlers.readlink = function (pathname, cb) {
    pathname = path.join(from, pathname)
    fs.readlink(pathname, function (err, link) {
      if (err) return cb(fuse.errno(err.code))
      if (link === from || link.indexOf(from + path.sep) === 0) link = link.replace(from, mnt)
      cb(0, link)
    })
  }

  handlers.chown = function (pathname, uid, gid, cb) {
    pathname = path.join(from, pathname)

    var done = function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'chown', path: pathname, uid: uid, gid: gid})
      cb(0)
    }

    fs.chown(pathname, uid, gid, function (err) {
      if (!err) return done()
      fs.lstat(pathname, function (_, st) {
        if (st && st.isSymbolicLink()) return done()
        done(err)
      })
    })
  }

  handlers.chmod = function (pathname, mode, cb) {
    pathname = path.join(from, pathname)

    var done = function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'chmod', path: pathname, mode: mode})
      cb(0)
    }

    fs.chmod(pathname, mode, function (err) {
      if (!err) return done()
      fs.lstat(pathname, function (_, st) {
        if (st && st.isSymbolicLink()) return done()
        done(err)
      })
    })
  }

  handlers.utimens = function (pathname, atime, mtime, cb) {
    pathname = path.join(from, pathname)

    var done = function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'utimes', path: pathname, atime: atime, mtime: mtime})
      cb(0)
    }

    fs.utimes(pathname, atime, mtime, function (err) {
      if (!err) return done()
      fs.lstat(pathname, function (_, st) {
        if (st && st.isSymbolicLink()) return done()
        done(err)
      })
    })
  }

  handlers.create = function (pathname, mode, cb) {
    pathname = path.join(from, pathname)
    fs.open(pathname, 'a', mode, function (err, fd) {
      if (err) return cb(fuse.errno(err.code))
      that.emit('change', {type: 'create', path: pathname, mode: mode})
      cb(0, fd)
    })
  }

  handlers.statfs = function (pathname, cb) {
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

  handlers.destroy = function (cb) {
    cb()
  }

  handlers.options = ['suid', 'dev']
  handlers.force = true
  handlers.displayFolder = true

  fuse.mount(mnt, handlers, function (err) {
    if (err) return that.emit('error', err)
    that.emit('mount')
  })

  return that
}
