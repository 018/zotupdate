let zotupdate = {
};

let isDebug = function() {
    return typeof Zotero != 'undefined'
        && typeof Zotero.Debug != 'undefined'
        && Zotero.Debug.enabled;
};

zotupdate.init = function() {
    // Register the callback in Zotero as an item observer
    let notifierID = Zotero.Notifier.registerObserver(
        this.notifierCallback, ['item']);

    // Unregister callback when the window closes (important to avoid a memory leak)
    window.addEventListener('unload', function(e) {
        Zotero.Notifier.unregisterObserver(notifierID);
    }, false);
};

// so citation counts will be queried for >all< items that are added to zotero!? o.O
zotupdate.notifierCallback = {
    notify: function(event, type, ids, extraData) {
        if (event == 'add') {
            // 新增
        }
    }
};

zotupdate.updateInfo = function() {
    var zitems = window.ZoteroPane.getSelectedItems();
    if (isDebug()) Zotero.debug("zitems.length: " + zitems.length);

    for (const zitem of zitems) {
        var url = zitem.getField('url');
        var extra = zitem.getField('extra');
        if(extra === 'ZSCC: NoCitationData[s0]') {
            zitem.setField('extra', '');
            zitem.saveTx();
        }
        
        Zotero.HTTP.doGet(url, function (req) {
            if(req.readyState == 4) {
                if (req.status == 200) {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(req.response, "text/html");
                    var target = doc.querySelector('strong[property*="v:average"]');
                    if(target){
                        var rating = target.textContent;
                        if (rating && (rating = rating.trim()).length >= 1) {
                            var ratingPeople = doc.querySelector('div.rating_sum a.rating_people span[property="v:votes"]').textContent;
                            if (!ratingPeople || ratingPeople.toString().trim().length <= 0) {
                                ratingPeople = 0;
                            }
                            zitem.setField('extra', rating + "/" + ratingPeople);
                            zitem.saveTx();
                        }
                    } else {
                        if (isDebug()) Zotero.debug("no target: " + doc.body.innerHTML);
                    }
                }
            }
        });
    }

    if(zitems.length == 1) {
        // 只支持一个，不然容易小黑屋。
        var zitem = zitems[0];
        var isbn = zitem.getField('ISBN').replace(/-/g, '');
        if(!isbn){
            return;
        }
        // clc
        if (isDebug()) Zotero.debug("isbn: "+ isbn);
        var url = "http://book.ucdrs.superlib.net/search?Field=all&channel=search&sw=" + isbn;
        Zotero.HTTP.doGet(url, function (req) {
            if(req.readyState == 4) {
                if (req.status == 200) {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(req.response, "text/html");
                    let books = doc.querySelectorAll('.book1');
                    if (!books || books.length <= 0) {
                        if (isDebug()) Zotero.debug("books.length: 0, " + doc.body.innerHTML);
                        return;
                    }
            
                    for (let book of books) {
                        let a = book.querySelector('.book1 td>table a.px14');
                        if (a) {
                            if (isDebug()) Zotero.debug("a.href: " + a.href);
                            // superlib 单本书籍查看
                            http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=000006890478&d=22F4AA31AA63E89AD8E558D9CA3D9178&fenlei=03100402
                            var url1 = a.href.replace('chrome://zotero', 'http://book.ucdrs.superlib.net');
                            Zotero.HTTP.doGet(url1, function (req1) {
                                if(req.readyState == 4) {
                                    if (req.status == 200) {
                                        var parser1 = new DOMParser();
                                        var doc1 = parser1.parseFromString(req1.response, "text/html");
                                        let tubox = doc1.querySelector('.tubox dl').textContent;
                                        let isbn1 = this.opt(/【ISBN号】.*\n/.exec(tubox)).replace(/【ISBN号】|-|\n/g, '');
                                        if (isDebug()) Zotero.debug("isbn eqisbn: " + isbn + " - " + isbn1);
                                        if (this.eqisbn(isbn, isbn1)) {
                                            let clc = this.opt(this.opt(/【中图法分类号】.*\n/.exec(tubox)).match(/[a-zA-Z0-9\.]+/));
                                            if (clc) {
                                                if (isDebug()) Zotero.debug("clc: " + clc);
                                                zitem.setField('archiveLocation', clc);
                                                zitem.saveTx()
                                            } else {
                                                if (isDebug()) Zotero.debug("no clc." + doc1.body.innerHTML);
                                            }
                                        } else {
                                            if (isDebug()) Zotero.debug("no eqisbn: " + isbn + ", " + isbn1);
                                        }
                                    }
                                }
                            }.bind(this));
                        }
                    }
                }
            }
        }.bind(this));
    }
    return;
};

zotupdate.eqisbn = function(val1, val2) {
	if (!val1 || (val1.length != 13 && val1.length != 10) || !val2 || (val2.length != 13 && val2.length != 10)) return false;

	let no1 = this.getISBNNo(val1);
	let no2 = this.getISBNNo(val2);
	return no1 == no2;
};

zotupdate.getISBNNo = function(val) {
	if (!val || (val.length != 13 && val.length != 10)) return;

	if (val.length == 13) {
		return val.substr(3, 9);
	} else if (val.length == 10) {
		return val.substr(0, 9);
	}
};

zotupdate.opt = function(val) {
	if (!val) return '';

	if (val instanceof Array) {
		if (val.length > 0) {
			return val[0];
		}
	} else {
		return val;
	}
};

if (typeof window !== 'undefined') {
    window.addEventListener('load', function(e) { zotupdate.init(); }, false);

    // API export for Zotero UI
    // Can't imagine those to not exist tbh
    if (!window.Zotero) window.Zotero = {};
    if (!window.Zotero.ZotUpdate) window.Zotero.ZotUpdate = {};
    // note sure about any of this
    window.Zotero.ZotUpdate.updateInfo
        = function() { zotupdate.updateInfo(); };
}

if (typeof module !== 'undefined') module.exports = zotupdate;
