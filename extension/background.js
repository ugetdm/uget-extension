/*
 * uGet Integration is an extension to integrate uGet Download manager
 * with Google Chrome, Chromium, Vivaldi, Opera and Mozilla Firefox in Linux and Windows.
 *
 * Copyright (C) 2016  Gobinath
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var EXTENSION_VERSION = "2.1.3";
var REQUIRED_INTEGRATOR_VERSION = "1.0.0";
var interruptDownloads = true;
var ugetIntegratorNotFound = true;
var disposition = '';
var hostName;
var ugetIntegratorVersion;
var ugetVersion = '';
var chromeVersion;
var firefoxVersion;
var minFileSizeToInterrupt = 300 * 1024; // 300 kb
var current_browser;
var filter = [];
var urlsToSkip = [];
var urlsToInterrupt = [];
var mimeToSkip = [];
var mimeToInterrupt = [];
mediasInTab = {};
var cookies = '';
var message = {
    URL: '',
    Cookies: '',
    UserAgent: '',
    FileName: '',
    FileSize: '',
    Referer: '',
    PostData: '',
    Batch: false,
    Version: EXTENSION_VERSION
};
var requestList = [{
    cookies: '',
    postData: '',
    id: ''
}, {
    cookies: '',
    postData: '',
    id: ''
}, {
    cookies: '',
    postData: '',
    id: ''
}];
var currRequest = 0;

function start() {
    initialize();
    readStorage();
    setDownloadHooks();
    enableVideoGrabber();
}
/**
 * Initialize the variables.
 */
function initialize() {
    // Get the running browser
    try {
        chromeVersion = /Chrome\/([0-9]+)/.exec(navigator.userAgent)[1];
    } catch (ex) {
        chromeVersion = 33;
    }
    try {
        current_browser = browser;
        hostName = 'com.ugetdm.firefox';
        current_browser.runtime.getBrowserInfo().then(
            function(info) {
                if (info.name === 'Firefox') {
                    // Convert version string to int
                    firefoxVersion = parseInt(info.version.replace(/[ab]\d+/, '').split('.')[0]);
                }
            }
        );
    } catch (ex) {
        firefoxVersion = 0;
        current_browser = chrome;
        hostName = 'com.ugetdm.chrome';
    }
    // Set keyboard shortcut listener
    current_browser.commands.onCommand.addListener(function(command) {
        if ("toggle-interruption" === command) {
            // Toggle
            setInterruptDownload(!interruptDownloads, true);
        }
    });
    chromeVersion = parseInt(chromeVersion);
    sendMessageToHost(message);
    createContextMenus();
}

/**
 * Read storage for extension specific preferences.
 * If no preferences found, initialize with default values.
 */
function readStorage() {
    current_browser.storage.sync.get(function(items) {
        // Read the storage for excluded keywords
        if (items["uget-urls-exclude"]) {
            urlsToSkip = items["uget-urls-exclude"].split(/[\s,]+/);
        } else {
            current_browser.storage.sync.set({ "uget-urls-exclude": '' });
        }

        // Read the storage for included keywords
        if (items["uget-urls-include"]) {
            urlsToInterrupt = items["uget-urls-include"].split(/[\s,]+/);
        } else {
            current_browser.storage.sync.set({ "uget-urls-include": '' });
        }

        if (items["uget-mime-exclude"]) {
            mimeToSkip = items["uget-mime-exclude"].split(/[\s,]+/);
        } else {
            current_browser.storage.sync.set({ "uget-mime-exclude": '' });
        }

        // Read the storage for included keywords
        if (items["uget-mime-include"]) {
            mimeToInterrupt = items["uget-mime-include"].split(/[\s,]+/);
        } else {
            current_browser.storage.sync.set({ "uget-mime-include": '' });
        }

        // Read the storage for the minimum file-size to interrupt
        if (items["uget-min-file-size"]) {
            minFileSizeToInterrupt = parseInt(items["uget-min-file-size"]);
        } else {
            current_browser.storage.sync.set({ "uget-min-file-size": minFileSizeToInterrupt });
        }

        // Read the storage for enabled flag
        if (!items["uget-interrupt"]) {
            // Keep the value string
            current_browser.storage.sync.set({ "uget-interrupt": 'true' });
        } else {
            var interrupt = (items["uget-interrupt"] == "true");
            setInterruptDownload(interrupt);
        }
    });
}

/**
 * Create required context menus and set listeners.
 */
function createContextMenus() {
    current_browser.contextMenus.create({
        title: 'Download with uGet',
        id: "download_with_uget",
        contexts: ['link']
    });

    current_browser.contextMenus.create({
        title: 'Download all links with uGet',
        id: "download_all_links_with_uget",
        contexts: ['page']
    });

    current_browser.contextMenus.create({
        title: 'Download media with uGet',
        id: "download_media_with_uget",
        enabled: false,
        contexts: ['page']
    });

    current_browser.contextMenus.onClicked.addListener(function(info, tab) {
        "use strict";
        var page_url = info.pageUrl;
        if (info.menuItemId === "download_with_uget") {
            message.URL = info['linkUrl'];
            message.Referer = page_url;
            current_browser.cookies.getAll({ 'url': extractRootURL(page_url) }, parseCookies);
        } else if (info.menuItemId === "download_all_links_with_uget") {
            current_browser.tabs.executeScript(null, { file: 'extract.js' }, function(results) {
                // Do nothing
                if (results[0].success) {
                    message.URL = results[0].urls;
                    message.Referer = page_url;
                    message.Batch = true;
                    current_browser.cookies.getAll({ 'url': extractRootURL(page_url) }, parseCookies);
                }
            });
        } else if (info.menuItemId === "download_media_with_uget") {
            if (page_url.includes('/www.youtube.com/watch?v=')) {
                // Youtube
                message.URL = page_url;
                message.Referer = page_url;
                current_browser.cookies.getAll({ 'url': extractRootURL(page_url) }, parseCookies);
            } else {
                // Other videos
                var media_set = mediasInTab[tab['id']];
                if (media_set) {
                    var urls = Array.from(media_set);
                    var no_or_urls = urls.length;
                    if (no_or_urls == 1) {
                        message.URL = urls[0];
                        message.Referer = page_url;
                        current_browser.cookies.getAll({ 'url': extractRootURL(page_url) }, parseCookies);
                    } else if (no_or_urls > 1) {
                        message.URL = urls.join('\n');
                        message.Referer = page_url;
                        message.Batch = true;
                        current_browser.cookies.getAll({ 'url': extractRootURL(page_url) }, parseCookies);
                    }
                }
            }

        }
    });
}

/**
 * Set hooks to interrupt downloads.
 */
function setDownloadHooks() {
    // Interrupt downloads on creation
    current_browser.downloads.onCreated.addListener(function(downloadItem) {

        if (ugetIntegratorNotFound || !interruptDownloads) { // uget-integrator not installed
            return;
        }

        if ("in_progress" !== downloadItem['state'].toString().toLowerCase()) {
            return;
        }

        var fileSize = downloadItem['fileSize'];
        var mime = downloadItem['mime'];

        var url = '';
        if (chromeVersion >= 54) {
            url = downloadItem['finalUrl'];
        } else {
            url = downloadItem['url'];
        }
        if (fileSize < minFileSizeToInterrupt && !(isWhiteListedURL(url) || isWhiteListedContent(mime))) {
            return;
        }
        if (isBlackListedURL(url) || isBlackListedContent(mime)) {
            return;
        }
        // Cancel the download
        current_browser.downloads.cancel(downloadItem.id);
        // Erase the download from list
        current_browser.downloads.erase({
            id: downloadItem.id
        });

        message.URL = url;
        message.FileName = unescape(downloadItem['filename']).replace(/\"/g, "");
        message.fileSize = fileSize;
        message.Referer = downloadItem['referrer'];
        current_browser.cookies.getAll({ 'url': extractRootURL(url) }, parseCookies);
    });

    current_browser.webRequest.onBeforeRequest.addListener(function(details) {
        if (details.method === 'POST') {
            message.PostData = postParams(details.requestBody.formData);
        }
        return {
            requestHeaders: details.requestHeaders
        };
    }, {
        urls: [
            '<all_urls>'
        ],
        types: [
            'main_frame',
            'sub_frame'
        ]
    }, [
        'blocking',
        'requestBody'
    ]);
    current_browser.webRequest.onBeforeSendHeaders.addListener(function(details) {
        currRequest++;
        if (currRequest > 2)
            currRequest = 2;
        requestList[currRequest].id = details.requestId;
        for (var i = 0; i < details.requestHeaders.length; ++i) {
            if (details.requestHeaders[i].name.toLowerCase() === 'user-agent') {
                message.UserAgent = details.requestHeaders[i].value;
            } else if (details.requestHeaders[i].name.toLowerCase() === 'referer') {
                requestList[currRequest].referrer = details.requestHeaders[i].value;
            } else if (details.requestHeaders[i].name.toLowerCase() === 'cookie') {
                requestList[currRequest].cookies = details.requestHeaders[i].value;
            }
        }
        return {
            requestHeaders: details.requestHeaders
        };
    }, {
        urls: [
            '<all_urls>'
        ],
        types: [
            'main_frame',
            'sub_frame',
            'xmlhttprequest'
        ]
    }, [
        'blocking',
        'requestHeaders'
    ]);
    current_browser.webRequest.onHeadersReceived.addListener(function(details) {


        if (ugetIntegratorNotFound) { // uget-integrator not installed
            return {
                responseHeaders: details.responseHeaders
            };
        }

        if (!details.statusLine.includes("200")) { // HTTP response is not OK
            return {
                responseHeaders: details.responseHeaders
            };
        }

        if (isBlackListedURL(details.url)) {
            return {
                responseHeaders: details.responseHeaders
            };
        }

        var interruptDownload = false;
        message.URL = details.url;
        var contentType = "";

        for (var i = 0; i < details.responseHeaders.length; ++i) {
            if (details.responseHeaders[i].name.toLowerCase() == 'content-length') {
                message.fileSize = details.responseHeaders[i].value;
                var fileSize = parseInt(message.fileSize);
                if (fileSize < minFileSizeToInterrupt && !isWhiteListedURL(message.URL)) {
                    return {
                        responseHeaders: details.responseHeaders
                    };
                }
            } else if (details.responseHeaders[i].name.toLowerCase() == 'content-disposition') {
                disposition = details.responseHeaders[i].value;
                if (disposition.lastIndexOf('filename') != -1) {
                    var found = disposition.match(/filename[^;=\n]*\*=UTF-8''((['"]).*?\2|[^;\n]*)/);
                    if (found) {
                        message.FileName = decodeURI(found[1]);
                    } else {
                        message.FileName = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)[1];
                        message.FileName = unescape(message.FileName).replace(/\"/g, "");
                    }
                    interruptDownload = true;
                }
            } else if (details.responseHeaders[i].name.toLowerCase() == 'content-type') {
                contentType = details.responseHeaders[i].value;
                if (isBlackListedContent(contentType)) {
                    interruptDownload = false;
                    return {
                        responseHeaders: details.responseHeaders
                    };
                } else if (isWhiteListedContent(contentType)) {
                    interruptDownload = true;
                } else {
                    return {
                        responseHeaders: details.responseHeaders
                    };
                }
            }
        }
        if (interruptDownload && interruptDownloads) {
            for (var i = 0; i < filter.length; i++) {
                if (filter[i] != "" && contentType.lastIndexOf(filter[i]) != -1) {
                    return {
                        responseHeaders: details.responseHeaders
                    };
                }
            }
            for (var j = 0; j < 3; j++) {
                if (details.requestId == requestList[j].id && requestList[j].id != "") {
                    message.Referer = requestList[j].referrer;
                    message.Cookies = requestList[j].cookies;
                    break;
                }
            }
            if (details.method != "POST") {
                message.PostData = '';
            }
            current_browser.cookies.getAll({ 'url': extractRootURL(message.URL) }, parseCookies);
            var scheme = /^https/.test(details.url) ? 'https' : 'http';
            if (chromeVersion >= 35 || firefoxVersion >= 51) {
                return {
                    redirectUrl: "javascript:"
                };
            } else if (details.frameId === 0) {
                current_browser.tabs.update(details.tabId, {
                    url: "javascript:"
                });
                var responseHeaders = details.responseHeaders.filter(function(header) {
                    var name = header.name.toLowerCase();
                    return name !== 'content-type' &&
                        name !== 'x-content-type-options' &&
                        name !== 'content-disposition';
                }).concat([{
                    name: 'Content-Type',
                    value: 'text/plain'
                }, {
                    name: 'X-Content-Type-Options',
                    value: 'nosniff'
                }]);
                return {
                    responseHeaders: responseHeaders
                };
            }
            return {
                cancel: true
            };
        } else {
            clearMessage();
        }
        return {
            responseHeaders: details.responseHeaders
        };
    }, {
        urls: [
            '<all_urls>'
        ],
        types: [
            'main_frame',
            'sub_frame'
        ]
    }, [
        'responseHeaders',
        'blocking'
    ]);
}

/**
 * Check the TAB URL and enable download_media_with_uget if the page is Youtube
 * @param {*int} tabId 
 */
function checkForYoutube(tabId, disableIfNot) {
    current_browser.tabs.get(tabId, function(tab) {
        isYoutube = tab['url'] && tab['url'].includes('/www.youtube.com/watch?v=')
        if (isYoutube) {
            current_browser.contextMenus.update("download_media_with_uget", { enabled: true });
        } else if (disableIfNot) {
            current_browser.contextMenus.update("download_media_with_uget", { enabled: false });
        }
    });
}

/**
 * Grab videos and add them to mediasInTab.
 */
function enableVideoGrabber() {
    current_browser.tabs.onActivated.addListener(function(activeInfo) {
        if (mediasInTab[activeInfo['tabId']] != undefined) {
            // Media already detected
            current_browser.contextMenus.update("download_media_with_uget", { enabled: true });
        } else {
            // Check for Youtube
            checkForYoutube(activeInfo['tabId'], true);
        }
    });

    current_browser.tabs.onRemoved.addListener(function(tabId, removeInfo) {
        if (mediasInTab[tabId]) {
            delete mediasInTab[tabId];
        }
    });

    current_browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        if (changeInfo['status'] === 'loading') {
            // Loading a new page
            delete mediasInTab[tabId];
        }
        // Check for Youtube
        checkForYoutube(tabId, false);
    });

    current_browser.webRequest.onResponseStarted.addListener(function(details) {
        content_url = details['url'];
        type = details['type'];
        if (type === 'media' || content_url.includes('mp4')) {
            tabId = details['tabId'];
            mediaSet = mediasInTab[tabId];
            if (mediaSet == undefined) {
                mediaSet = new Set();
                mediasInTab[tabId] = mediaSet;
            }
            mediaSet.add(content_url);
            current_browser.contextMenus.update("download_media_with_uget", { enabled: true });
        }
    }, {
        urls: [
            '<all_urls>'
        ],
        types: [
            'media',
            'object'
        ]
    });
}

////////////////// Utility Functions //////////////////
/**
 * Send message to uget-integrator
 */
function sendMessageToHost(message) {
    current_browser.runtime.sendNativeMessage(hostName, message, function(response) {
        clearMessage();
        ugetIntegratorNotFound = (response == null);
        if (!ugetIntegratorNotFound && !ugetIntegratorVersion) {
            ugetIntegratorVersion = response.Version;
            ugetVersion = response.Uget;
        }
        changeIcon();
    });
}

/**
 * Return the internal state.
 */
function getState() {
    if (ugetIntegratorNotFound || !ugetIntegratorVersion) {
        return 2;
    } else if (!ugetIntegratorVersion.startsWith(REQUIRED_INTEGRATOR_VERSION)) {
        return 1;
    } else {
        return 0;
    }
}

/**
 * Clear the message.
 */
function clearMessage() {
    message.URL = '';
    message.Cookies = '';
    message.FileName = '';
    message.fileSize = '';
    message.Referer = '';
    message.UserAgent = '';
    message.Batch = false;
}

/**
 * Extract the POST parameters from a form data.
 */
function postParams(source) {
    var array = [];
    for (var key in source) {
        array.push(encodeURIComponent(key) + '=' + encodeURIComponent(source[key]));
    }
    return array.join('&');
}

/**
 * Extract the root of a URL.
 */
function extractRootURL(url) {
    var domain;
    if (url.indexOf("://") > -1) {
        domain = url.split('/')[0] + '/' + url.split('/')[1] + '/' + url.split('/')[2];
    } else {
        domain = url.split('/')[0];
    }
    return domain;
}

/**
 * Parse the cookies and send the message to the native host.
 */
function parseCookies(cookies_arr) {
    cookies = '';
    for (var i in cookies_arr) {
        cookies += cookies_arr[i].domain + '\t';
        cookies += (cookies_arr[i].httpOnly ? "FALSE" : "TRUE") + '\t';
        cookies += cookies_arr[i].path + '\t';
        cookies += (cookies_arr[i].secure ? "TRUE" : "FALSE") + '\t';
        cookies += Math.round(cookies_arr[i].expirationDate) + '\t';
        cookies += cookies_arr[i].name + '\t';
        cookies += cookies_arr[i].value;
        cookies += '\n';
    }
    message.Cookies = cookies;
    sendMessageToHost(message);
}

/**
 * Update the exclude keywords.
 * Is called from the popup.js.
 */
function updateExcludeKeywords(exclude) {
    if (exclude === "") {
        urlsToSkip = [];
    } else {
        urlsToSkip = exclude.split(/[\s,]+/);
    }
    current_browser.storage.sync.set({ "uget-urls-exclude": exclude });
}

/**
 * Update the include keywords.
 * Is called from the popup.js.
 */
function updateIncludeKeywords(include) {
    if (include === "") {
        urlsToInterrupt = [];
    } else {
        urlsToInterrupt = include.split(/[\s,]+/);
    }
    current_browser.storage.sync.set({ "uget-urls-include": include });
}

/**
 * Update the exclude MIMEs.
 * Is called from the popup.js.
 */
function updateExcludeMIMEs(exclude) {
    if (exclude === "") {
        mimeToSkip = [];
    } else {
        mimeToSkip = exclude.split(/[\s,]+/);
    }
    current_browser.storage.sync.set({ "uget-mime-exclude": exclude });
}

/**
 * Update the include MIMEs.
 * Is called from the popup.js.
 */
function updateIncludeMIMEs(include) {
    if (include === "") {
        mimeToInterrupt = [];
    } else {
        mimeToInterrupt = include.split(/[\s,]+/);
    }
    current_browser.storage.sync.set({ "uget-mime-include": include });
}

/**
 * Update the minimum file size to interrupt.
 * Is called from the popup.js.
 */
function updateMinFileSize(size) {
    minFileSizeToInterrupt = size;
    current_browser.storage.sync.set({ "uget-min-file-size": size });
}

/**
 * Check whether not to interrupt the given url.
 */
function isBlackListedURL(url) {
    if (!url) {
        return true;
    }
    blackListed = false;
    // Test the URL
    if (url.includes("//docs.google.com/") || url.includes("googleusercontent.com/docs")) { // Cannot download from Google Docs
        blackListed = true;
    }
    for (var keyword of urlsToSkip) {
        if (url.includes(keyword)) {
            blackListed = true;
            break;
        }
    }
    return blackListed;
}

/**
 * Check whether not to interrupt the given url.
 */
function isBlackListedContent(contentType) {
    blackListed = false;
    // Test the content type
    if (contentType) {
        if (/\b(?:xml|rss|javascript|json|html|text)\b/.test(contentType)) {
            blackListed = true;
        } else {
            for (var keyword of mimeToSkip) {
                if (contentType.includes(keyword)) {
                    blackListed = true;
                    break;
                }
            }
        }
    }
    return blackListed;
}

/**
 * Check whether to interrupt the given url or not.
 */
function isWhiteListedURL(url) {
    if (!url) {
        return false;
    }
    whiteListed = false;
    // Test the URL
    if (url.includes("video")) {
        whiteListed = true;
    }
    for (var keyword of urlsToInterrupt) {
        if (url.includes(keyword)) {
            whiteListed = true;
            break;
        }
    }
    return whiteListed;
}

/**
 * Check whether to interrupt the given content or not.
 */
function isWhiteListedContent(contentType) {
    whiteListed = false;
    // Test the content type
    if (contentType) {
        // if (/\b(?:application\/|video\/|audio\/)\b/.test(contentType)) {
        //     whiteListed = true;
        // } else {
        for (var keyword of mimeToInterrupt) {
            if (contentType.includes(keyword)) {
                whiteListed = true;
                break;
            }
        }
        // }
    }
    return whiteListed;
}

/**
 * Enable/Disable the plugin and update the plugin icon based on the state.
 */
function setInterruptDownload(interrupt, writeToStorage) {
    interruptDownloads = interrupt;
    if (writeToStorage) {
        current_browser.storage.sync.set({ "uget-interrupt": interrupt.toString() });
    }
    changeIcon();
}

/**
 * Change extension icon based on current state.
 */
function changeIcon() {
    state = getState();
    iconPath = "./icon_32.png";
    if (state == 0 && !interruptDownloads) {
        iconPath = "./icon_disabled_32.png";
    } else if (state == 1) {
        // Warning
        iconPath = "./icon_warning_32.png";
    } else if (state == 2) {
        // Error
        iconPath = "./icon_error_32.png";
    }
    current_browser.browserAction.setIcon({
        path: iconPath
    });
}

start();