var difffs = require('./')

difffs('/Users/maf', 'mnt').on('data', function (data) {
  console.log('change', data)
})
