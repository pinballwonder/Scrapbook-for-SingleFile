/*
 * Copyright 2011 Gildas Lormeau
 * contact : gildas.lormeau <at> gmail.com
 * 
 * This file is part of Scrapbook for SingleFile.
 *
 *   Scrapbook for SingleFile is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Scrapbook for SingleFile is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Lesser General Public License for more details.
 *
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with Scrapbook for SingleFile.  If not, see <http://www.gnu.org/licenses/>.
 */

var dev = false;

var DEFAULT_ARGS = {
	sortBy : {
		field : "date",
		value : "desc"
	},
	limit : 20
};

var notificationArchiving, timeoutNoResponse, firstUse = localStorage.defaultArgs == null, defaultArgs = localStorage.defaultArgs ? JSON
		.parse(localStorage.defaultArgs) : DEFAULT_ARGS, args = JSON.parse(JSON.stringify(defaultArgs)), searchedTabs, searchedTags, expandedPages = [], newPages = [], expandedTags = [], singleFileID;

var tabs = {
	length : 0
}, importingState, exportingState, exportingToZipState, importingFromZipState;

function deletePages(ids, callback) {
	storage.deletePages(ids, callback);
}

function setRating(id, rating) {
	storage.setRating(id, rating);
}

function search(callback) {
	storage.search(args, callback);
}

function resetDatabase() {
	storage.reset();
	localStorage.clear();
}

function getContent(id, callback) {
	storage.getContent(id, callback);
}

function open(id, selected) {
	chrome.tabs.create({
		url : "pages/stub.html?" + id,
		selected : selected
	});
}

function openURL(url, selected) {
	chrome.tabs.create({
		url : url,
		selected : selected
	});
}

function openPages(ids) {
	ids.forEach(function(id, index) {
		if (index)
			open(id, false);
		else
			open(id, getOpenBgTab() != "yes");
	});
}

function getDoctype(doc) {
	var docType = doc.doctype, docTypeStr;
	if (docType) {
		docTypeStr = "<!DOCTYPE " + docType.nodeName;
		if (docType.publicId) {
			docTypeStr += " PUBLIC \"" + docType.publicId + "\"";
			if (docType.systemId)
				docTypeStr += " \"" + docType.systemId + "\"";
		} else if (docType.systemId)
			docTypeStr += " SYSTEM \"" + docType.systemId + "\"";
		if (docType.internalSubset)
			docTypeStr += " [" + docType.internalSubset + "]";
		return docTypeStr + ">\n";
	}
	return "";
}

function updatePage() {
	var element = linkedElement;
	resetLinkedElement();
	storage.updatePage(element.archiveId, getDoctype(element.archiveDoc) + element.archiveDoc.documentElement.outerHTML);
}

function resetLinkedElement() {
	linkedElement.link.style.backgroundColor = null;
	linkedElement = null;
}

function setLinkedElement(element) {
	linkedElement = element;
	linkedElement.link.style.backgroundColor = "green";
	tab = "pages";
}

function openLink(url) {
	chrome.tabs.create({
		url : url
	});
}

function getPage(url, callback) {
	storage.getPage(url, callback);
}

function addTag(pageId, tag, callback) {
	storage.addTag(pageId, tag, callback);
}

function removeTag(pageId, id, callback) {
	storage.removeTag(pageId, id, callback);
}

function getTags(callback) {
	storage.getTags(searchedTags, callback);
}

function updateTagValue(oldValue, newValue) {
	storage.updateTagValue(oldValue, newValue);
}

function deleteTags(tagIds, callback) {
	storage.deleteTags(tagIds, callback);
}

function setTitle(id, title) {
	storage.setTitle(id, title);
}

function getTagsCompletion(searchTags, callback) {
	storage.getTagsCompletion(searchTags, callback);
}

function getTagCompletion(searchTag, pageId, callback) {
	storage.getTagCompletion(searchTag, pageId, callback);
}

function addTags(tagValues, pageIds, callback) {
	storage.addTags(tagValues, pageIds, callback);
}

function getSelectedTab(callback) {
	chrome.tabs.getSelected(null, function(tab) {
		callback(tab);
	});
}

function detectExtension(extensionId, callback) {
	var img;
	img = new Image();
	img.src = "chrome-extension://" + extensionId + "/resources/icon_16.png";
	img.onload = function() {
		callback(true);
	};
	img.onerror = function() {
		callback(false);
	};
}

function detectSingleFile(callback) {
	var SINGLE_FILE_BETA_ID = dev ? "gdeieoedpffolbofhgfoecpocddeajda" : "ocjhfplakacigfckfgfejpbjpbcjodmk";
	if (singleFileID)
		callback(singleFileID);
	else
		detectExtension(SINGLE_FILE_BETA_ID, function(detected) {
			var SINGLE_FILE_ID = dev ? "oabofdibacblkhpogjinmdbcekfkikjc" /* "onlinihoegnbbcmeeocfeplgbkmoidla" */: "jemlklgaibiijojffihnhieihhagocma";
			if (detected) {
				singleFileID = SINGLE_FILE_BETA_ID;
				callback(singleFileID);
			} else
				detectExtension(SINGLE_FILE_ID, function(detected) {
					if (detected) {
						singleFileID = SINGLE_FILE_ID;
						callback(singleFileID);
					} else
						callback();
				});
		});
}

function getTabsInfo(callback) {
	chrome.tabs.getAllInWindow(null, function(tabs) {
		if (searchedTabs)
			tabs = tabs.filter(function(tab) {
				var i, test = true;
				for (i = 0; i < searchedTabs.length && test; i++)
					test = test && tab.title.toLowerCase().indexOf(searchedTabs[i].toLowerCase()) != -1;
				return test;
			});
		callback(tabs);
	});
}

function onProcessEnd() {
	var notification = webkitNotifications.createHTMLNotification('notificationOK.html');
	if (notificationArchiving)
		notificationArchiving.cancel();
	if (timeoutNoResponse)
		clearTimeout(timeoutNoResponse);
	timeoutNoResponse = null;
	notification.show();
	setTimeout(function() {
		notification.cancel();
	}, 3000);
}

function setTimeoutNoResponse() {
	if (timeoutNoResponse)
		clearTimeout(timeoutNoResponse);
	timeoutNoResponse = setTimeout(function() {
		var notificationNoResponse = webkitNotifications.createHTMLNotification('notificationTimeout.html');
		tabs = {
			length : 0
		};
		notificationNoResponse.show();
		setTimeout(function() {
			notificationNoResponse.cancel();
		}, 3000);
		timeoutNoResponse = null;
	}, 60000);
}

function saveTabs(tabIds) {
	notificationArchiving = webkitNotifications.createHTMLNotification('notificationArchiving.html');
	notificationArchiving.show();
	setTimeout(function() {
		notificationArchiving.cancel();
	}, 3000);
	setTimeoutNoResponse();
	tabIds.forEach(function(tabId) {
		notifyTabProgress(tabId, 0, 0, 100);
	});
	chrome.extension.sendRequest(singleFileID, {
		tabIds : tabIds
	}, function() {
	});
}

function selectTab(tabId) {
	chrome.tabs.update(tabId, {
		selected : true
	});
}

function setDefaultFilters() {
	localStorage.defaultArgs = JSON.stringify(args);
}

function resetDefaultFilters() {
	args = DEFAULT_ARGS;
	setDefaultFilters();
}

function openBgTab(value) {
	localStorage.openBgTab = value;
}

function askConfirm(value) {
	localStorage.askConfirm = value;
}

function expandArchives(value) {
	localStorage.expandArchives = value;
}

function getOpenBgTab() {
	return localStorage.openBgTab != null ? localStorage.openBgTab : "yes";
}

function getAskConfirm() {
	return localStorage.askConfirm != null ? localStorage.askConfirm : "yes";
}

function getExpandArchives() {
	return localStorage.expandArchives != null ? localStorage.expandArchives : "yes";
}

function setFilesystemEnabled(value) {
	localStorage.filesystemEnabled = value;
}

function getFilesystemEnabled() {
	return localStorage.filesystemEnabled != null ? localStorage.filesystemEnabled : "";
}

function notifyViews(notifyHandler) {
	var views = chrome.extension.getViews(), popups = chrome.extension.getViews({
		type : "popup"
	}), extensionPages = [];
	if (popups.length)
		extensionPages = popups;
	views.forEach(function(view) {
		if (view.location.href.indexOf("chrome-extension://" + location.host + "/pages/popup.html") == 0)
			extensionPages.push(view);
	});
	extensionPages.forEach(function(extensionPage) {
		if (extensionPage != this)
			notifyHandler(extensionPage);
	});
}

function importDB() {
	importingState = {
		index : 0,
		max : 0
	};
	storage.importDB(function(index, max) {
		importingState = {
			index : index,
			max : max
		};
		notifyViews(function(extensionPage) {
			extensionPage.notifyImportProgress();
		});
	}, function() {
		importingState = null;
		notifyViews(function(extensionPage) {
			if (extensionPage.notifyImportProgress)
				extensionPage.notifyImportProgress();
		});
	});
}

function exportDB() {
	exportingState = {
		index : 0,
		max : 0
	};
	storage.exportDB(function(index, max) {
		exportingState = {
			index : index,
			max : max
		};
		notifyViews(function(extensionPage) {
			extensionPage.notifyExportProgress();
		});
	}, function() {
		exportingState = null;
		notifyViews(function(extensionPage) {
			extensionPage.notifyExportProgress();
		});
	});
}

function exportToZip(ids) {
	var notificationExporting;

	exportingToZipState = {
		index : 0,
		max : 0
	};
	notificationExporting = webkitNotifications.createHTMLNotification('notificationExporting.html');
	notificationExporting.show();
	setTimeout(function() {
		notificationExporting.cancel();
	}, 3000);
	storage.exportToZip(ids, function(index, max) {
		exportingToZipState = {
			index : index,
			max : max
		};
		notifyViews(function(extensionPage) {
			extensionPage.notifyExportToZipProgress();
		});
	}, function(file) {
		var notificationExportOK;
		exportingToZipState = null;
		notifyViews(function(extensionPage) {
			extensionPage.notifyExportToZipProgress();
		});
		notificationExporting.cancel();
		chrome.tabs.create({
			url : webkitURL.createObjectURL(file),
			selected : false
		});
		notificationExportOK = webkitNotifications.createHTMLNotification('notificationExportOK.html');
		notificationExporting.cancel();
		notificationExportOK.show();
		setTimeout(function() {
			notificationExportOK.cancel();
		}, 3000);
	});
}

function importFromZip(file) {
	var notificationImporting;

	importingFromZipState = {
		index : 0,
		max : 0
	};
	notificationImporting = webkitNotifications.createHTMLNotification('notificationImporting.html');
	notificationImporting.show();
	setTimeout(function() {
		notificationImporting.cancel();
	}, 3000);
	storage.importFromZip(file, function(index, max) {
		importingFromZipState = {
			index : index,
			max : max
		};
		notifyViews(function(extensionPage) {
			extensionPage.notifyImportFromZipProgress();
		});
	}, function() {
		var notificationImportOK;
		importingFromZipState = null;
		notifyViews(function(extensionPage) {
			extensionPage.notifyImportFromZipProgress();
		});
		notificationImportOK = webkitNotifications.createHTMLNotification('notificationImportOK.html');
		notificationImporting.cancel();
		notificationImportOK.show();
		setTimeout(function() {
			notificationImportOK.cancel();
		}, 3000);
	});
}

function cancelImportDB() {
	importingState = null;
}

function cancelExportDB() {
	exportingState = null;
}

function notifyTabProgress(tabId, state, index, max) {
	notifyViews(function(extensionPage) {
		extensionPage.notifyTabProgress(tabId, state, index, max);
	});
	if (state == 2) {
		if (tabs[tabId])
			tabs.length--;
		delete tabs[tabId];
	} else {
		if (!tabs[tabId])
			tabs.length++;
		tabs[tabId] = {
			state : state,
			index : index,
			max : max
		};
	}
}

setDefaultFilters();
args.currentPage = 0;

chrome.extension.onRequestExternal.addListener(function(request, sender, sendResponse) {
	setTimeoutNoResponse();
	if (request.processStart)
		notifyTabProgress(request.tabId, 0, 0, 100);
	else if (request.processProgress)
		notifyTabProgress(request.tabId, 1, request.tabIndex, request.tabMaxIndex);
	else if (request.processEnd) {
		notifyTabProgress(request.tabId, 2);
		if (tabs.length == 0)
			onProcessEnd();
		storage.addContent(request.content, request.title, request.url, request.favicoData, function(id) {
			if (getExpandArchives() == "yes")
				newPages[id] = true;
		}, function() {
			webkitNotifications.createHTMLNotification('notificationFileError.html').show();
		});
		sendResponse({});
	}
});