# difffs

Fuse based filesystem that notifies you when changes happen

```
npm install -g difffs
```

## Usage

```
difffs [directory] [mountpoint]
```

For example to mount your home folder do `/tmp/mnt` do

```
mkdir /tmp/mnt
difffs ~ /tmp/mnt
```

Now if you navigate to `/tmp/mnt` and edit/create a file or a folder the above command will print out the change

## Programmatic API

You can also use it as a node module

``` js
var difffs = require('difffs')

var diff = difffs('/Users/maf', '/tmp/mnt')

diff.on('change', function(change) {
  console.log('the filesystem changed', change)
})
```

## Dependencies

On OSX you'll need the following

* osx fuse, http://sourceforge.net/projects/osxfuse/files/latest/download?source=files
* pkg-config, `brew install pkg-config`


## License

MIT
