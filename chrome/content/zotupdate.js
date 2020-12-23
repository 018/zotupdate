let zotupdate = {
  _bundle: Cc['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://zoterozotupdate/locale/zotupdate.properties')
}

let isDebug = function () {
  return typeof Zotero !== 'undefined' && typeof Zotero.Debug !== 'undefined' && Zotero.Debug.enabled
}

zotupdate.init = function () {
  // Register the callback in Zotero as an item observer
  let notifierID = Zotero.Notifier.registerObserver(this.notifierCallback, ['item'])

  // Unregister callback when the window closes (important to avoid a memory leak)
  window.addEventListener('unload', function (e) {
    Zotero.Notifier.unregisterObserver(notifierID)
  }, false)
}

// so citation counts will be queried for >all< items that are added to zotero!? o.O
zotupdate.notifierCallback = {
  notify: function (event, type, ids, extraData) {
    // 新增
    if (event === 'add') {
    }
  }
}

zotupdate.pullDir = function () {
  var zitems = this.getSelectedItems(['book'])
  if (!zitems || zitems.length <= 0) {
    var ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    ps.alert(window, this.getString('zotupdate.warning'), this.getString('zotupdate.only_book'))
    return
  }
  if (isDebug()) Zotero.debug('zitems.length: ' + zitems.length)

  var pw = new Zotero.ProgressWindow()
  pw.changeHeadline(this.getString('zotupdate.title.pulldir'))
  pw.addDescription(this.getString('zotupdate.choose', zitems.length))
  pw.show()

  var promises = []
  for (const zitem of zitems) {
    if (isDebug()) Zotero.debug(zitem)
    var url = zitem.getField('url')

    let id = this.getIDFromURL(url)
    promises.push(Zotero.HTTP.processDocuments(url, async function (doc) {
      var e = doc.querySelector('#dir_' + id + '_full')
      if (e) {
        var dir = e.textContent
        if (dir) {
          dir = dir.replace(/(([\xA0\s]*)\n([\xA0\s]*))+/g, '<br>').replace('· · · · · ·     (收起)', '')
          var item = new Zotero.Item('note')
          item.setNote('<p><strong>目录</strong></p>\n<p>' + dir + '</p>')
          item.parentKey = zitem.getField('key')
          var itemID = await item.saveTx()
          if (isDebug()) Zotero.debug('item.id: ' + itemID)
          ZoteroPane.selectItem(itemID)
          pw.addLines(this.getString('zotupdate.dir_found', zitem.getField('title')))
        } else {
          pw.addLines(this.getString('zotupdate.no_dir_found', zitem.getField('title')))
        }
      } else {
        pw.addLines(this.getString('zotupdate.no_dir_found', zitem.getField('title')))
      }
    }.bind(this)))
  }

  Promise.all(promises).then((result) => {
    pw.addDescription(this.getString('zotupdate.click_on_close'))
  }).catch((error) => {
    pw.addLines(error)
    pw.addDescription(this.getString('zotupdate.click_on_close'))
  })
}

zotupdate.tryRead = function () {
  var zitems = this.getSelectedItems(['book'])
  if (!zitems || zitems.length <= 0) {
    var ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    ps.alert(window, this.getString('zotupdate.warning'), this.getString('zotupdate.only_book'))
    return
  }
  if (isDebug()) Zotero.debug('zitems.length: ' + zitems.length)

  if (zitems.length !== 1) {
    var ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    ps.alert(window, this.getString('zotupdate.warning'), this.getString('zotupdate.only_one'))
    return
  }

  // 只支持一个，不然容易小黑屋。
  var zitem = zitems[0]
  var isbn = zitem.getField('ISBN').replace(/-/g, '')
  if (!isbn) {
    var ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    ps.alert(window, this.getString('zotupdate.warning'), this.getString('zotupdate.no_isbn_found', zitem.getField('title')))
    return
  }

  var pw = new Zotero.ProgressWindow()
  pw.changeHeadline(this.getString('zotupdate.title.tryread'))
  pw.addDescription(this.getString('zotupdate.downloading'))
  pw.show()

  var promises = []
  if (isDebug()) Zotero.debug('isbn: ' + isbn)
  var url = 'http://book.ucdrs.superlib.net/search?Field=all&channel=search&sw=' + isbn
  promises.push(Zotero.HTTP.processDocuments(url, function (doc) {
    let books = doc.querySelectorAll('.book1')
    if (!books || books.length <= 0) {
      pw.close()
      var ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
      ps.alert(window, this.getString('zotupdate.warning'), this.getString('zotupdate.no_tryread_found', zitem.getField('title')) + '(1)')
      if (isDebug()) Zotero.debug('books.length: 0, ' + doc.body.innerHTML)
      return
    }

    for (let book of books) {
      let a = book.querySelector('.book1 td>table a.px14')
      if (a) {
        if (isDebug()) Zotero.debug('a.href: ' + a.href)
        // superlib 单本书籍查看
        var url1 = a.href.replace('chrome://zotero', 'http://book.ucdrs.superlib.net')
        promises.push(Zotero.HTTP.processDocuments(url1, function (doc1) {
          var as1 = doc1.querySelector('.testimg a')
          if (!as1) {
            as1 = doc1.querySelector('.link a')
          }
          if (as1) {
            promises.push(Zotero.HTTP.processDocuments(as1.href, function (doc2) {
              var assistUrl = doc2.querySelector('#downpdf [name=assistUrl]').value
              var cntUrl = doc2.querySelector('#downpdf [name=cntUrl]').value
              var url = (cntUrl || assistUrl)
              if (isDebug()) Zotero.debug('Found cntUrl: ' + cntUrl)
              if (isDebug()) Zotero.debug('Found assistUrl: ' + assistUrl)
              if (isDebug()) Zotero.debug('Found url: ' + url)
              Zotero.Attachments.importFromURL({
                'libraryID': zitem.libraryID,
                'url': url,
                'parentItemID': zitem.id,
                'contentType': 'application/pdf',
                'title': '试读'
              })
              pw.addDescription(this.getString('zotupdate.tryread_found', zitem.getField('title')))
              pw.addDescription(this.getString('zotupdate.click_on_close'))
            }.bind(this)))
          } else {
            pw.addDescription(this.getString('zotupdate.no_tryread_found', zitem.getField('title')) + '(2)')
          }
        }.bind(this)))
      }
    }
  }.bind(this)))

  Promise.all(promises).then((result) => {
    pw.addDescription(this.getString('zotupdate.click_on_close'))
  }).catch((error) => {
    pw.addLines(error)
    pw.addDescription(this.getString('zotupdate.click_on_close'))
  })
}

zotupdate.eBook = function () {
  var zitems = this.getSelectedItems(['book'])
  if (!zitems || zitems.length <= 0) {
    var ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    ps.alert(window, this.getString('zotupdate.warning'), this.getString('zotupdate.only_book'))
    return
  }

  if (isDebug()) Zotero.debug('zitems.length: ' + zitems.length)

  if (zitems.length !== 1) {
    var ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    ps.alert(window, this.getString('zotupdate.warning'), this.getString('zotupdate.only_one'))
    return
  }

  // 只支持一个，不然容易小黑屋。
  var zitem = zitems[0]
  var title = zitem.getField('title')
  var isbn = zitem.getField('ISBN').replace(/-/g, '')
  if (!isbn) {
    var ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    ps.alert(window, this.getString('zotupdate.warning'), this.getString('zotupdate.no_isbn_found', zitem.getField('title')))
    return
  }

  var pw = new Zotero.ProgressWindow()
  pw.changeHeadline(this.getString('zotupdate.title.ebook'))
  pw.addDescription(this.getString('zotupdate.downloading'))
  pw.show()

  if (isDebug()) Zotero.debug('isbn: ' + isbn)
  Zotero.HTTP.processDocuments('https://b-ok.global/s/' + isbn, function (doc) {
    let found = false
    for (let a of doc.querySelectorAll('table.resItemTable h3[itemprop=name] a')) {
      if (a.textContent.includes(title) || title.includes(a.textContent)) {
        let url = a.href.replace(location.host, 'b-ok.global').replace('http:', 'https:')
        found = true
        Zotero.HTTP.processDocuments(url, function (doc1) {
          let addDownloadedBook = doc1.querySelector('.addDownloadedBook')
          if (addDownloadedBook) {
            if (isDebug()) Zotero.debug('Found: ' + addDownloadedBook.textContent)
            let txt = addDownloadedBook.textContent.match(/\(.*\)/g) + '';
            url = addDownloadedBook.href.replace(location.host, 'b-ok.global').replace('http:', 'https:')
            if (isDebug()) Zotero.debug('Found txt: ' + txt)
            if (isDebug()) Zotero.debug('Found url: ' + url)
            if (isDebug()) Zotero.debug(zitem.id + ' Found: ' + txt.replace(/\(|\)|(\,.*)/g, '') + ',' + url)
            var title = txt.replace(/\(|\)|(\,.*)/g, '')
            Zotero.Attachments.importFromURL({
              'libraryID': zitem.libraryID,
              'url': url,
              'parentItemID': zitem.id,
              'contentType': 'application/pdf',
              'title': this.getString('zotupdate.ebook') + '(' + title + ')'
            })
            pw.addDescription(this.getString('zotupdate.ebook_found', zitem.getField('title'), txt))
            pw.addDescription(this.getString('zotupdate.click_on_close'))
          } else {
            pw.addDescription(this.getString('zotupdate.no_ebook_found', zitem.getField('title')) + '(1)')
            pw.addDescription(this.getString('zotupdate.click_on_close'))
          }
        }.bind(this))
      }
    }

    if (!found) {
      pw.addDescription(this.getString('zotupdate.no_ebook_found', zitem.getField('title')) + '(2)')
      pw.addDescription(this.getString('zotupdate.click_on_close'))
    }
  }.bind(this))
}

zotupdate.updateRating = function (zitem, pw, url, promises) {
  if (url.includes('douban.com')) {
    promises.push(Zotero.HTTP.processDocuments(url, function (doc) {
      var target = doc.querySelector('strong[property*="v:average"]')
      if (target) {
        var rating = target.textContent
        if (rating && (rating = rating.trim()).length >= 1) {
          var ratingPeople = doc.querySelector('div.rating_sum a.rating_people span[property="v:votes"]').textContent
          if (!ratingPeople || ratingPeople.toString().trim().length <= 0) {
            ratingPeople = 0
          }
          var txt = rating + '/' + ratingPeople
          pw.addLines(this.getString('zotupdate.score_found', zitem.getField('title'), txt))
          zitem.setField('extra', txt)
          zitem.saveTx()
        } else {
          pw.addLines(this.getString('zotupdate.no_score_found', zitem.getField('title')) + '(1)')
        }
      } else {
        pw.addLines(this.getString('zotupdate.no_score_found', zitem.getField('title')) + '(2)')
        if (isDebug()) Zotero.debug('no target: ' + doc.body.innerHTML)
      }
    }.bind(this)))
  } else {
    pw.addLines(this.getString('zotupdate.no_score_found', zitem.getField('title')) + '(3)')

    /*var isbn = zitem.getField('ISBN').replace(/-/g, '')
    if (!isbn) {
      pw.addLines(this.getString('zotupdate.no_isbn_found', zitem.getField('title')))
      return
    }

    if (isDebug()) Zotero.debug('subject_search: ' + isbn)
    promises.push(Zotero.HTTP.processDocuments('https://search.douban.com/book/subject_search?search_text=' + isbn, function (doc) {
      var a = doc.querySelector('.detail a')
      if (a) {
        if (isDebug()) Zotero.debug('Found: ' + a.href)
        this.updateRating(zitem, pw, a.href, promises)
      } else {
        pw.addLines(this.getString('zotupdate.no_score_found', zitem.getField('title')) + '(2)')
        if (isDebug()) Zotero.debug('no target: ' + doc.body.innerHTML)
      }
    }.bind(this)))*/
  }
}

zotupdate.updateInfo = function () {
  var zitems = this.getSelectedItems(['book'])
  if (!zitems || zitems.length <= 0) {
    var ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    ps.alert(window, this.getString('zotupdate.warning'), this.getString('zotupdate.only_book'))
    return
  }
  if (isDebug()) Zotero.debug('zitems.length: ' + zitems.length)

  var pw = new Zotero.ProgressWindow()
  pw.changeHeadline(this.getString('zotupdate.title.update'))
  pw.addDescription(this.getString('zotupdate.choose', zitems.length))
  pw.show()
  if (isDebug()) Zotero.debug(pw)

  var promises = []
  for (const zitem of zitems) {
    var url = zitem.getField('url')
    var extra = zitem.getField('extra')
    if (extra === 'ZSCC: NoCitationData[s0]') {
      zitem.setField('extra', '')
      zitem.saveTx()
    }

    this.updateRating(zitem, pw, url, promises)
  }

  if (zitems.length === 1) {
    // 只支持一个，不然容易小黑屋。
    var zitem = zitems[0]
    var isbn = zitem.getField('ISBN').replace(/-/g, '')
    if (!isbn) {
      pw.addLines(this.getString('zotupdate.no_isbn_found', zitem.getField('title')))
      return
    }
    // clc
    if (isDebug()) Zotero.debug('isbn: ' + isbn)
    promises.push(Zotero.HTTP.processDocuments('http://book.ucdrs.superlib.net/search?Field=all&channel=search&sw=' + isbn, function (doc) {
      let books = doc.querySelectorAll('.book1')
      if (!books || books.length <= 0) {
        pw.addLines(this.getString('zotupdate.no_clc_found', zitem.getField('title')) + '(1)')
        if (isDebug()) Zotero.debug('books.length: 0, ' + doc.body.innerHTML)
        return
      }

      for (let book of books) {
        let a = book.querySelector('.book1 td>table a.px14')
        if (a) {
          if (isDebug()) Zotero.debug('a.href: ' + a.href)
          // superlib 单本书籍查看
          var url1 = a.href.replace('chrome://zotero', 'http://book.ucdrs.superlib.net')
          promises.push(Zotero.HTTP.processDocuments(url1, function (doc1) {
            let tubox = doc1.querySelector('.tubox dl').textContent
            let isbn1 = this.opt(/【ISBN号】.*\n/.exec(tubox)).replace(/【ISBN号】|-|\n/g, '')
            if (isDebug()) Zotero.debug('isbn eqisbn: ' + isbn + ' - ' + isbn1)
            if (this.eqisbn(isbn, isbn1)) {
              let clc = this.opt(this.opt(/【中图法分类号】.*\n/.exec(tubox)).match(/[a-zA-Z0-9\.;]+/))
              if (clc) {
                if (isDebug()) Zotero.debug('clc: ' + clc)
                pw.addLines(this.getString('zotupdate.clc_found', zitem.getField('title'), clc))
                zitem.setField('archiveLocation', clc)
                zitem.saveTx()
              } else {
                pw.addLines(this.getString('zotupdate.no_clc_found', zitem.getField('title')) + '(2)')
                if (isDebug()) Zotero.debug('no clc.' + doc1.body.innerHTML)
              }
            } else {
              pw.addLines(this.getString('zotupdate.no_clc_found', zitem.getField('title')) + isbn + ' <>' + isbn1)
              if (isDebug()) Zotero.debug('no eqisbn: ' + isbn + ', ' + isbn1)
            }
          }.bind(this)))
        } else {
          pw.addLines(this.getString('zotupdate.no_clc_found', zitem.getField('title')) + '(3)')
          if (isDebug()) Zotero.debug('no a.' + doc.body.innerHTML)
        }
      }
    }.bind(this)))
  } else {
    pw.addLines(this.getString('zotupdate.multiple_skipping'))
  }

  Promise.all(promises).then((result) => {
    pw.addDescription(this.getString('zotupdate.click_on_close'))
  }).catch((error) => {
    pw.addLines(error)
    pw.addDescription(this.getString('zotupdate.click_on_close'))
  })
}

zotupdate.clearup = function() {
  var zitems = this.getSelectedItems(['book'])
  if (!zitems || zitems.length <= 0) {
    var ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService)
    ps.alert(window, this.getString('zotupdate.warning'), this.getString('zotupdate.only_book'))
    return
  }
  if (isDebug()) Zotero.debug('zitems.length: ' + zitems.length)
  var pw = new Zotero.ProgressWindow()
  pw.changeHeadline(this.getString('zotupdate.title.clearup'))
  pw.addDescription(this.getString('zotupdate.choose', zitems.length))
  pw.show()
  if (isDebug()) Zotero.debug(pw)

  for (const zitem of zitems) {
    Zotero.debug(zitem)

    var title = zitem.getField('title') || ''
    var _title = title.replace(/[\(|（](.*?)[\)|）]/g, '($1)')
    Zotero.debug(_title + ' >>> ' + title)
    zitem.setField('title', _title)
    if (title !== _title) {
      pw.addLines(title + ' >>> ' + _title, title)
    }

    var abstractNote = (zitem.getField('abstractNote') || '').replace(/•/g, '·')
    zitem.setField('abstractNote', abstractNote)

    var creators = zitem.getCreators()
    if (creators) {
      for (const creator of creators) {
        Zotero.debug('creator: ' + JSON.stringify(creator))
        let lastName = (creator.lastName || '').replace(/ /g, '')
          .replace(/[\(|（|\[|【|［|〔](.{1,2})[\)|）|\]|】|］|〕]/g, '[$1]')
          .replace(/[\(|（](.*?)[\)|）]/g, '($1)')
          .replace(/•/g, '·')
        if (creator.lastName !== lastName) {
          pw.addLines(creator.lastName + ' >>> ' + lastName, zitem.getField('title'))
        }
        creator.lastName = lastName
      }
    }
    zitem.setCreators(creators)
    zitem.saveTx()
  }
}

zotupdate.getIDFromURL = function (url) {
  if (!url) return ''

  var id = url.match(/subject\/.*\//g)
  if (!id) return ''

  return id[0].replace(/subject|\//g, '')
}

zotupdate.eqisbn = function (val1, val2) {
  if (!val1 || (val1.length !== 13 && val1.length !== 10) || !val2 || (val2.length !== 13 && val2.length !== 10)) return false;

  let no1 = this.getISBNNo(val1)
  let no2 = this.getISBNNo(val2)
  return no1 === no2
}

zotupdate.getISBNNo = function (val) {
  if (!val || (val.length !== 13 && val.length !== 10)) return

  if (val.length === 13) {
    return val.substr(3, 9)
  } else if (val.length === 10) {
    return val.substr(0, 9)
  }
}

zotupdate.opt = function (val) {
  if (!val) return ''

  if (val instanceof Array) {
    if (val.length > 0) {
      return val[0]
    }
  } else {
    return val
  }
}

zotupdate.getString = function (name, ...params) {
  if (params !== undefined) {
    return this._bundle.formatStringFromName(name, params, params.length)
  } else {
    return this._bundle.GetStringFromName(name)
  }
}

zotupdate.getSelectedItems = function (itemType) {
  var zitems = window.ZoteroPane.getSelectedItems()
  if (!zitems.length) {
    if (isDebug()) Zotero.debug('zitems.length: ' + zitems.length)
    return false
  }

  if (itemType) {
    if (!Array.isArray(itemType)) {
      itemType = [itemType]
    }
    var siftedItems = this.siftItems(zitems, itemType)
    if (isDebug()) Zotero.debug('siftedItems.matched: ' + siftedItems.matched)
    return siftedItems.matched
  } else {
    return zitems
  }
}

zotupdate.siftItems = function (itemArray, itemTypeArray) {
  var matchedItems = []
  var unmatchedItems = []
  while (itemArray.length > 0) {
    if (this.checkItemType(itemArray[0], itemTypeArray)) {
      matchedItems.push(itemArray.shift())
    } else {
      unmatchedItems.push(itemArray.shift())
    }
  }

  return {
    matched: matchedItems,
    unmatched: unmatchedItems
  }
}

zotupdate.checkItemType = function (itemObj, itemTypeArray) {
  var matchBool = false

  for (var idx = 0; idx < itemTypeArray.length; idx++) {
    switch (itemTypeArray[idx]) {
      case 'attachment':
        matchBool = itemObj.isAttachment()
        break
      case 'note':
        matchBool = itemObj.isNote()
        break
      case 'regular':
        matchBool = itemObj.isRegularItem()
        break
      default:
        matchBool = Zotero.ItemTypes.getName(itemObj.itemTypeID) === itemTypeArray[idx]
    }

    if (matchBool) {
      break
    }
  }

  return matchBool
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', function (e) { zotupdate.init() }, false)

  // API export for Zotero UI
  // Can't imagine those to not exist tbh
  if (!window.Zotero) window.Zotero = {}
  if (!window.Zotero.ZotUpdate) window.Zotero.ZotUpdate = {}
  // note sure about any of this
  window.Zotero.ZotUpdate.updateInfo = function () { zotupdate.updateInfo() }
  window.Zotero.ZotUpdate.clearup = function () { zotupdate.clearup() }
  window.Zotero.ZotUpdate.pullDir = function () { zotupdate.pullDir() }
  window.Zotero.ZotUpdate.tryRead = function () { zotupdate.tryRead() }
  window.Zotero.ZotUpdate.eBook = function () { zotupdate.eBook() }
}

if (typeof module !== 'undefined') module.exports = zotupdate
