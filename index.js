var fuse = require('fuse-bindings')
var mknod = require('mknod')
var fs = require('fs')
var path = require('path')
var stream = require('readable-stream')
var constants = require('constants')

module.exports = function (from, mnt, opts) {
  if (!opts) opts = {}
  opts.objectMode = true

  var utimes = opts.utimes !== false
  var handlers = {}
  var that = new stream.PassThrough(opts)

  from = path.resolve(from)
  mnt = path.resolve(mnt)

  that.directory = from
  that.mountpoint = mnt

  that.unmount = function (cb) {
    fuse.unmount(mnt, function (err) {
      that.end()
      if (cb) cb(err)
    })
  }

  that.on('close', function () {
    that.emit('unmount')
  })

  that.on('finish', function () {
    that.emit('unmount')
  })

  that.destroyed = false
  that.destroy = function (err) {
    fuse.unmount(mnt, function (unmountErr) {
      if (that.destroyed) return
      that.destroyed = true
      if (err) that.emit('error', unmountErr || err)
      that.emit('close')
    })
  }

  handlers.mknod = function (pathname, mode, dev, cb) {
    pathname = path.join(from, pathname)
    mknod(pathname, mode, dev, function (err) {
      if (err) return cb(fuse.EPERM)
      that.write({path: pathname, type: 'mknod', mode: mode, dev: dev}, function () {
        cb(0)
      })
    })
  }

  handlers.getattr = function (pathname, cb) {
    fs.lstat(path.join(from, pathname), function (err, st) {
      if (err) return cb(fuse.errno(err.code))
      cb(0, st)
    })
  }

  handlers.fgetattr = function (pathname, fd, cb) {
    fs.fstat(fd, function (err, st) {
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

  handlers.open = function (pathname, flags, cb) {
    pathname = path.join(from, pathname)
    fs.open(pathname, flags, function (err, fd) {
      if (err) return cb(fuse.errno(err.code))

      var done = function () {
        cb(0, fd)
      }

      if (flags & constants.O_TRUNC && !(flags & constants.O_EXCL)) that.write({path: pathname, type: 'truncate', size: 0}, done)
      else done()
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
    fs.truncate(pathname, size, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.write({path: pathname, type: 'truncate', size: size}, function () {
        cb(0)
      })
    })
  }

  handlers.ftruncate = function (pathname, fd, size, cb) {
    pathname = path.join(from, pathname)
    fs.ftruncate(fd, size, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.write({path: pathname, type: 'truncate', size: size}, function () {
        cb(0)
      })
    })
  }

  handlers.fsync = function (pathname, fd, datasync, cb) {
    pathname = path.join(from, pathname)
    fs.fsync(fd, function (err) {
      if (err) return cb(fuse.errno(err.code))
      cb(0)
    })
  }

  handlers.write = function (pathname, handle, buf, len, offset, cb) {
    pathname = path.join(from, pathname)
    fs.write(handle, buf, 0, len, offset, function (err, bytes) {
      if (err) return cb(fuse.errno(err.code))
      var copy = new Buffer(bytes) // copy needed as fuse overrides this buffer
      buf.copy(copy)
      that.write({path: pathname, type: 'write', offset: offset, data: copy}, function () {
        cb(bytes)
      })
    })
  }

  handlers.unlink = function (pathname, cb) {
    pathname = path.join(from, pathname)
    fs.unlink(pathname, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.write({path: pathname, type: 'unlink'}, function () {
        cb(0)
      })
    })
  }

  handlers.symlink = function (src, dst, cb) {
    dst = path.join(from, dst)
    if (src === mnt || src.indexOf(mnt + path.sep) === 0) src = src.replace(mnt, from)
    fs.symlink(src, dst, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.write({path: src, type: 'symlink', destination: dst}, function () {
        cb(0)
      })
    })
  }

  handlers.link = function (src, dst, cb) {
    src = path.join(from, src)
    dst = path.join(from, dst)
    fs.link(src, dst, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.write({path: src, type: 'link', destination: dst}, function () {
        cb(0)
      })
    })
  }

  handlers.rename = function (src, dst, cb) {
    src = path.join(from, src)
    dst = path.join(from, dst)
    fs.rename(src, dst, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.write({path: src, type: 'rename', destination: dst}, function () {
        cb(0)
      })
    })
  }

  handlers.mkdir = function (pathname, mode, cb) {
    pathname = path.join(from, pathname)
    fs.mkdir(pathname, mode, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.write({path: pathname, type: 'mkdir', mode: mode}, function () {
        cb(0)
      })
    })
  }

  handlers.rmdir = function (pathname, cb) {
    pathname = path.join(from, pathname)
    fs.rmdir(pathname, function (err) {
      if (err) return cb(fuse.errno(err.code))
      that.write({path: pathname, type: 'rmdir'}, function () {
        cb(0)
      })
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
    fs.lstat(pathname, function (_, st) {
      if (st && st.isSymbolicLink()) return cb(0)
      fs.chown(pathname, uid, gid, function (err) {
        if (err) return cb(fuse.errno(err.code))
        that.write({path: pathname, type: 'chown', uid: uid, gid: gid}, function () {
          cb(0)
        })
      })
    })
  }

  handlers.chmod = function (pathname, mode, cb) {
    pathname = path.join(from, pathname)
    fs.lstat(pathname, function (_, st) {
      if (st && st.isSymbolicLink()) return cb(0)
      fs.chmod(pathname, mode, function (err) {
        if (err) return cb(fuse.errno(err.code))
        that.write({path: pathname, type: 'chmod', mode: mode}, function () {
          cb(0)
        })
      })
    })
  }

  handlers.utimens = function (pathname, atime, mtime, cb) {
    pathname = path.join(from, pathname)
    fs.lstat(pathname, function (_, st) {
      if (st && st.isSymbolicLink()) return cb(0)
      fs.utimes(pathname, atime, mtime, function (err) {
        if (err) return cb(fuse.errno(err.code))
        if (!utimes) return cb(0)
        that.write({path: pathname, type: 'utimes', atime: atime, mtime: mtime}, function () {
          cb(0)
        })
      })
    })
  }

  handlers.create = function (pathname, mode, cb) {
    pathname = path.join(from, pathname)
    fs.open(pathname, 'wx+', mode, function (err, fd) {
      if (err) return cb(fuse.errno(err.code))
      that.write({path: pathname, type: 'create', mode: mode}, function () {
        cb(0, fd)
      })
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
    if (err) return that.destroy(err)
    that.emit('mount')
  })

  return that
}
