if (!window.Zotero) window.Zotero = {}
if (!window.Zotero.ZotUpdate) window.Zotero.ZotUpdate = {}
if (!window.Zotero.ZotUpdate) window.Zotero.ZotUpdate.Utils = {}

window.Zotero.ZotUpdate.Utils = {
  _bundle: Cc['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://zoterouread/locale/uread.properties')
}

window.Zotero.ZotUpdate.Utils.warning = function (message) {
  Zotero.alert(null, Zotero.getString('general.warning'), message)
}

window.Zotero.ZotUpdate.Utils.success = function (message) {
  Zotero.alert(null, Zotero.getString('general.success'), message)
}

window.Zotero.ZotUpdate.Utils.error = function (message) {
  Zotero.alert(null, Zotero.getString('general.error'), message)
}

window.Zotero.ZotUpdate.Utils.confirm = function (message) {
  var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
  return ps.confirm(null, Zotero.getString('general.warning'), message)
}

window.Zotero.ZotUpdate.Utils.getParam = function (url, name) {
  if (!url) return ''

  var src = new RegExp('[?&]' + name + '=([^&#]*)').exec(url)

  /* eslint-disable no-undef */
  return src && src[1] ? src[1] : ''
}

window.Zotero.ZotUpdate.Utils.eqisbn = function (val1, val2) {
  if (!val1 || (val1.length !== 13 && val1.length !== 10) || !val2 || (val2.length !== 13 && val2.length !== 10)) return false

  let no1 = this.getISBNNo(val1)
  let no2 = this.getISBNNo(val2)
  return no1 === no2
}

window.Zotero.ZotUpdate.Utils.getISBNNo = function (val) {
  if (!val || (val.length !== 13 && val.length !== 10)) return

  if (val.length === 13) {
    return val.substr(3, 9)
  } else if (val.length === 10) {
    return val.substr(0, 9)
  }
}

window.Zotero.ZotUpdate.Utils.opt = function (val) {
  if (!val) return ''

  if (val instanceof Array) {
    if (val.length > 0) {
      return val[0]
    }
  } else {
    return val
  }
}

window.Zotero.ZotUpdate.Utils.getString = function (name, ...params) {
  if (params !== undefined && params.length > 0) {
    return this._bundle.formatStringFromName(name, params, params.length)
  } else {
    return this._bundle.GetStringFromName(name)
  }
}

window.Zotero.ZotUpdate.Utils.getSelectedItems = function (itemType) {
  var zitems = window.ZoteroPane.getSelectedItems()
  if (!zitems.length) {
    Zotero.debug('window.Zotero.ZotUpdate.Utils@zitems.length: ' + zitems.length)
    return false
  }

  if (itemType) {
    if (!Array.isArray(itemType)) {
      itemType = [itemType]
    }
    var siftedItems = this.siftItems(zitems, itemType)
    Zotero.debug('window.Zotero.ZotUpdate.Utils@siftedItems.matched: ' + siftedItems.matched.length)
    return siftedItems.matched
  } else {
    return zitems
  }
}

window.Zotero.ZotUpdate.Utils.siftItems = function (itemArray, itemTypeArray) {
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

window.Zotero.ZotUpdate.Utils.checkItemType = function (itemObj, itemTypeArray) {
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

window.Zotero.ZotUpdate.Utils.loadDocumentAsync = async function (url, onDone, onError, dontDelete, cookieSandbox) {
  let doc = await new Zotero.Promise(function (resolve, reject) {
    var browser = Zotero.HTTP.loadDocuments(url,
      Zotero.Promise.coroutine(function* () {
        try {
          resolve(browser.contentDocument)
        } catch (e) {
          reject(e)
        } finally {
          Zotero.Browser.deleteHiddenBrowser(browser)
        }
      }),
      onDone,
      onError,
      dontDelete,
      cookieSandbox
    )
  })
  return doc
}

window.Zotero.ZotUpdate.Utils.requestAsync = async function (url) {
  var xmlhttp = await Zotero.HTTP.request('GET', url)
  return xmlhttp
}

window.Zotero.ZotUpdate.Utils.htmlToText = function (html) {
  var	nsIFC = Components.classes['@mozilla.org/widget/htmlformatconverter;1'].createInstance(Components.interfaces.nsIFormatConverter)
  var from = Components.classes['@mozilla.org/supports-string;1'].createInstance(Components.interfaces.nsISupportsString)
  from.data = html
  var to = { value: null }
  try {
    nsIFC.convert('text/html', from, from.toString().length, 'text/unicode', to, {})
    to = to.value.QueryInterface(Components.interfaces.nsISupportsString)
    return to.toString()
  } catch (e) {
    Zotero.debug(e, 1)
    return html
  }
}

window.Zotero.ZotUpdate.Utils.dataURItoBlob = function (dataURI) {
  var mimeString = dataURI
    .split(',')[0]
    .split(':')[1]
    .split(';')[0]
  var byteString = atob(dataURI.split(',')[1])
  var arrayBuffer = new ArrayBuffer(byteString.length)
  var intArray = new Uint8Array(arrayBuffer)
  for (var i = 0; i < byteString.length; i++) {
    intArray[i] = byteString.charCodeAt(i)
  }
  return new Blob([intArray], { type: mimeString })
}

window.Zotero.ZotUpdate.Utils.blobToDataURI = function (blob, callback) {
  var reader = new FileReader()
  reader.onload = function (e) {
    callback(e.target.result)
  }
  reader.readAsDataURL(blob)
}
