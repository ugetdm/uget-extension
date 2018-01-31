# uGet Extension

Integrate the uGet Download Manager with Google Chrome, Chromium, Vivaldi, Opera and Mozilla Firefox.

## How to install

1. Install the latest version of [uGet Download Manager](http://ugetdm.com/)
2. Install the latest version of [uget-integrator](https://github.com/ugetdm/uget-integrator)
3. Install the `uGet Integration` extension.
    - Google Chrome, Chromium and Vivaldi: [Chrome Extension](https://chrome.google.com/webstore/detail/uget-integration/efjgjleilhflffpbnkaofpmdnajdpepi)
    - Opera: [Opera Addon](https://addons.opera.com/en/extensions/details/uget-integration)
    - Mozilla Firefox 56+: [Firefox Addon](https://addons.mozilla.org/en-US/firefox/addon/ugetintegration/)

## How to use

Just click on any downloadable links to download the file. 'uGet new Download' dialog will appear and continue the download. You can also right click on a link and select `Download with uGet`.

To download all links, right click on the web page and select `Download all links with uGet`. In Youtube, you will get an additional menu item `Download media with uGet` to download video.

Use <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>U</kbd> to toggle interruption.

### Extension status signals

uGet Integration extension requires [uget-integrator](https://github.com/ugetdm/uget-integrator) to integrate [uGet Download Manager](http://ugetdm.com/) with your browser. The extension indicates any connection issues using the following signals.

 - Green icon (<img src="https://github.com/ugetdm/uget-extension/raw/master/extension/icon_32.png" width="16px">) with a message: `Info: Found uGet and uget-integrator` means everything works as intended
 - Grey icon (<img src="https://github.com/ugetdm/uget-extension/raw/master/extension/icon_disabled_32.png" width="16px">) with a message: `Info: Found uGet and uget-integrator` means everything works as intended but for the moment uGet Extension is disabled. You can enable it either using the switch in the popup dialog of the extension or using <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>U</kbd> shortcut
 - Yellow icon (<img src="https://github.com/ugetdm/uget-extension/raw/master/extension/icon_warning_32.png" width="16px">) with a message: `Warning: Please upgrade uget-integrator to the latest version` means the version of [uget-integrator](https://github.com/ugetdm/uget-integrator) does not match with the expected version. You can fix it by installing the latest `uget-integrator`
 - Red icon (<img src="https://github.com/ugetdm/uget-extension/raw/master/extension/icon_error_32.png" width="16px">) with a message: `Error: Unable to connect with uget-integrator` means either you have not installed [uGet Download Manager](http://ugetdm.com/) and/or [uget-integrator](https://github.com/ugetdm/uget-integrator) or the `uget-integrator` is not detected by the extension. In the later scenario, please check the known issues and if you could not solve the problem, please open a new [issue](https://github.com/ugetdm/uget-extension/issues)

## Known Issues

### Firefox not interrupting downloads (Issue [#43](https://github.com/slgobinath/uget-chrome-wrapper/issues/43))

If Firefox does not interrupt the downloads but `Download with uGet` works, delete the `handlers.json` from the following path.

```
~/.mozilla/firefox/mwad0hks.default/handlers.json
```

You may have a different folder name instead of `mwad0hks.default`. Firefox Nightly users may have `firefox-trunk` folder instead of `firefox`.

## License

GNU General Public License v3