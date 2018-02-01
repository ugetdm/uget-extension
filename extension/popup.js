/*
 * uget-chrome-wrapper is an extension to integrate uGet Download manager
 * with Google Chrome, Chromium, Vivaldi and Opera in Linux and Windows.
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

var current_browser;

try {
    current_browser = browser;
    current_browser.runtime.getBrowserInfo().then(
        function(info) {
            if (info.name === 'Firefox') {
                // Do nothing
            }
        }
    );
} catch (ex) {
    // Not Firefox
    current_browser = chrome;
}

$(document).ready(function() {
    // Show the system status
    current_browser.runtime.getBackgroundPage(function(backgroundPage) {
        var state = backgroundPage.getState();
        if (state == 0) {
            $('#info').css('display', 'block');
            $('#warn').css('display', 'none');
            $('#error').css('display', 'none');
        } else if (state == 1) {
            $('#info').css('display', 'none');
            $('#warn').css('display', 'block');
            $('#error').css('display', 'none');
        } else {
            $('#info').css('display', 'none');
            $('#warn').css('display', 'none');
            $('#error').css('display', 'block');
        }
    });

    current_browser.storage.sync.get(function(items) {
        $('#urlsToExclude').val(items["uget-urls-exclude"]);
        $('#urlsToInclude').val(items["uget-urls-include"]);
        $('#mimeToExclude').val(items["uget-mime-exclude"]);
        $('#mimeToInclude').val(items["uget-mime-include"]);
        $('#fileSize').val(parseInt(items["uget-min-file-size"]) / 1024);
        $('#chk_enable').prop('checked', items["uget-interrupt"] == "true");
    });

    // Set event listeners
    $('#chk_enable').change(function() {
        var enabled = this.checked;
        current_browser.runtime.getBackgroundPage(function(backgroundPage) {
            backgroundPage.setInterruptDownload(enabled, true);
        });
    });
    $("#fileSize").on("change paste", function() {
        var minFileSize = parseInt($(this).val());
        if (isNaN(minFileSize)) {
            minFileSize = 300;
        } else if (minFileSize < -1) {
            minFileSize = -1;
        }
        $('#fileSize').val(minFileSize);
        current_browser.runtime.getBackgroundPage(function(backgroundPage) {
            backgroundPage.updateMinFileSize(minFileSize * 1024);
        });
    });
    $("#urlsToExclude").on("change paste", function() {
        var keywords = $(this).val().trim();
        current_browser.runtime.getBackgroundPage(function(backgroundPage) {
            backgroundPage.updateExcludeKeywords(keywords);
        });
    });
    $("#urlsToInclude").on("change paste", function() {
        var keywords = $(this).val().trim();
        current_browser.runtime.getBackgroundPage(function(backgroundPage) {
            backgroundPage.updateIncludeKeywords(keywords);
        });
    });
    $("#mimeToExclude").on("change paste", function() {
        var keywords = $(this).val().trim();
        current_browser.runtime.getBackgroundPage(function(backgroundPage) {
            backgroundPage.updateExcludeMIMEs(keywords);
        });
    });
    $("#mimeToInclude").on("change paste", function() {
        var keywords = $(this).val().trim();
        current_browser.runtime.getBackgroundPage(function(backgroundPage) {
            backgroundPage.updateIncludeMIMEs(keywords);
        });
    });
});